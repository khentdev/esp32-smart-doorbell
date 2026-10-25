<script setup lang="ts">
import { useId } from 'vue'
import { ChevronDown, Play } from '@lucide/vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import { PRESETS } from '@/utils/presetSounds'
import type { SoundPreference } from '@/stores/settings/soundStore'

defineProps<{ canPreview: boolean }>()
defineEmits<{ preview: [] }>()

const model = defineModel<SoundPreference>({ required: true })
const id = useId()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-ink text-sm font-medium">Notification sound</label>
    <div class="flex gap-2.5">
      <div class="relative min-w-0 flex-1">
        <select
          :id="id"
          v-model="model"
          class="border-line bg-surface text-ink focus:border-accent h-12 w-full appearance-none rounded-xl border pr-10 pl-3.5 text-base focus:ring-4 focus:ring-(--ring) focus:outline-none"
        >
          <option v-for="p in PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
          <option value="custom">Upload custom sound</option>
        </select>
        <ChevronDown
          class="text-muted pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
        />
      </div>
      <BaseButton
        variant="secondary"
        class="h-12!"
        :disabled="!canPreview"
        aria-label="Preview sound"
        @click="$emit('preview')"
      >
        <template #icon><Play class="size-4" /></template>
        <span class="hidden sm:inline">Preview</span>
      </BaseButton>
    </div>
  </div>
</template>
