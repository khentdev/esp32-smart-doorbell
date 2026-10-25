import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { playPreset, type PresetId } from '@/utils/presetSounds'
import { loadCustomSound, saveCustomSound } from '@/utils/soundStorage'

export type SoundPreference = PresetId | 'custom'

const PREF_KEY = 'sound-preference'
const DEFAULT_PREF: SoundPreference = 'chime'
const VALID: SoundPreference[] = ['chime', 'bell', 'alert', 'custom']

function readPreference(): SoundPreference {
  try {
    const raw = localStorage.getItem(PREF_KEY) as SoundPreference | null
    return raw && VALID.includes(raw) ? raw : DEFAULT_PREF
  } catch {
    return DEFAULT_PREF
  }
}

export const useSoundStore = defineStore('sound', () => {
  const preference = ref<SoundPreference>(readPreference())
  const customName = ref<string | null>(null)
  const customBlob = ref<Blob | null>(null)
  const loaded = ref(false)

  const hasCustom = computed(() => customBlob.value !== null)

  async function load() {
    if (loaded.value) return
    const stored = await loadCustomSound()
    if (stored) {
      customBlob.value = stored.blob
      customName.value = stored.name
    } else if (preference.value === 'custom') {
      preference.value = DEFAULT_PREF
    }
    loaded.value = true
  }

  function playBlob(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = audio.onerror = () => URL.revokeObjectURL(url)
    void audio.play().catch(() => URL.revokeObjectURL(url))
  }

  /** Plays any preference; `blob` lets Settings preview a not-yet-saved upload. */
  function preview(pref: SoundPreference, blob?: Blob | null) {
    if (pref === 'custom') {
      const source = blob ?? customBlob.value
      if (source) playBlob(source)
    } else {
      playPreset(pref)
    }
  }

  const playSaved = () => preview(preference.value)

  /** Persists the preference (and a new custom file, if given). Applies to future toasts at once. */
  async function save(pref: SoundPreference, file?: File | null) {
    if (pref === 'custom' && file) {
      await saveCustomSound({ blob: file, name: file.name })
      customBlob.value = file
      customName.value = file.name
    }
    preference.value = pref
    try {
      localStorage.setItem(PREF_KEY, pref)
    } catch {
      /* preference lives in memory for this session */
    }
  }

  return { preference, customName, customBlob, hasCustom, load, preview, playSaved, save }
})
