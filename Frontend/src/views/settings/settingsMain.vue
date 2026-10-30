<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import BasePanel from '@/components/shared/BasePanel.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import SoundPicker from '@/components/settings/SoundPicker.vue'
import CustomSoundUpload from '@/components/settings/CustomSoundUpload.vue'
import EnrollFingerprint from '@/components/settings/EnrollFingerprint.vue'
import FingerprintList from '@/components/settings/FingerprintList.vue'
import { useFingerprintStore } from '@/stores/fingerprints/fingerprintStore'
import { useSoundStore, type SoundPreference } from '@/stores/settings/soundStore'
import { useToast } from '@/composables/Toast'

const sound = useSoundStore()
const fingerprints = useFingerprintStore()
const toast = useToast()

onMounted(() => void fingerprints.fetch({ silent: fingerprints.hasLoaded }))

const draft = ref<SoundPreference>(sound.preference)
const draftFile = ref<File | null>(null)
const saving = ref(false)

// The saved preference can change after the custom sound finishes loading from IndexedDB.
watch(
  () => sound.preference,
  (value) => (draft.value = value),
)

const customName = computed(() => draftFile.value?.name ?? sound.customName)
const hasCustomSource = computed(() => draftFile.value !== null || sound.hasCustom)
const dirty = computed(() => draft.value !== sound.preference || draftFile.value !== null)
const canPreview = computed(() => draft.value !== 'custom' || hasCustomSource.value)
const canSave = computed(() => dirty.value && canPreview.value && !saving.value)

function preview() {
  sound.preview(draft.value, draftFile.value)
}

async function save() {
  saving.value = true
  try {
    await sound.save(draft.value, draftFile.value)
    draftFile.value = null
    toast.success('Sound saved', 'It will play on every new access event.')
  } catch {
    toast.error("Couldn't save sound", 'Your browser blocked local storage for custom sounds.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <RouterLink
      :to="{ name: 'dashboard' }"
      class="text-muted hover:text-ink mb-5 inline-flex h-11 items-center gap-1.5 text-sm"
    >
      <ArrowLeft class="size-4" />
      Dashboard
    </RouterLink>

    <h1 class="text-ink mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
    <p class="text-muted mb-6 text-sm">Who can open the door, and how you're notified.</p>

    <BasePanel
      title="Fingerprints"
      description="People who can open the door"
      class="mb-6 overflow-hidden"
    >
      <FingerprintList />
      <div class="border-line border-t">
        <EnrollFingerprint />
      </div>
    </BasePanel>

    <BasePanel
      title="Notifications"
      description="Played with every toast · stored on this device only"
    >
      <form class="flex flex-col gap-5 p-5 sm:p-6" @submit.prevent="save">
        <SoundPicker v-model="draft" :can-preview="canPreview" @preview="preview" />

        <Transition name="fade">
          <CustomSoundUpload
            v-if="draft === 'custom'"
            :file-name="customName"
            @select="(file) => (draftFile = file)"
          />
        </Transition>

        <div class="flex justify-end">
          <BaseButton type="submit" :loading="saving" :disabled="!canSave" class="w-full sm:w-auto">
            Save
          </BaseButton>
        </div>
      </form>
    </BasePanel>
  </div>
</template>
