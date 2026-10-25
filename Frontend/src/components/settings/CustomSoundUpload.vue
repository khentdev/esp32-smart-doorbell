<script setup lang="ts">
import { ref } from 'vue'
import { FileAudio, Upload } from '@lucide/vue'
import { validateSoundFile } from '@/utils/soundStorage'

defineProps<{ fileName: string | null }>()
const emit = defineEmits<{ select: [file: File] }>()

const input = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)
const checking = ref(false)

async function onChange(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = '' // allow re-picking the same file after an error
  if (!file) return

  checking.value = true
  error.value = null
  const result = await validateSoundFile(file)
  checking.value = false

  if (result.ok) emit('select', file)
  else error.value = result.error
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <input
      ref="input"
      type="file"
      accept=".mp3,.wav,audio/mpeg,audio/wav"
      class="sr-only"
      tabindex="-1"
      @change="onChange"
    />
    <button
      type="button"
      class="border-line bg-surface-2 hover:border-accent flex min-h-16 items-center gap-3.5 rounded-xl border border-dashed px-4 py-3 text-left transition-colors"
      :class="error && 'border-denied'"
      :disabled="checking"
      @click="input?.click()"
    >
      <span class="bg-surface text-muted grid size-10 shrink-0 place-items-center rounded-xl">
        <FileAudio v-if="fileName" class="size-5" />
        <Upload v-else class="size-5" />
      </span>
      <span class="min-w-0">
        <span class="text-ink block truncate text-sm font-medium">
          {{ checking ? 'Checking file…' : (fileName ?? 'Choose an audio file') }}
        </span>
        <span class="text-muted block text-[13px]">.mp3 or .wav · max 5 MB · max 5 seconds</span>
      </span>
    </button>
    <p v-if="error" class="text-denied text-[13px]" role="alert">{{ error }}</p>
  </div>
</template>
