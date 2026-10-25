<script setup lang="ts">
import { RotateCw, TriangleAlert } from '@lucide/vue'
import BaseButton from './BaseButton.vue'

withDefaults(defineProps<{ title?: string; message?: string; retryLabel?: string }>(), {
  title: 'Something went wrong',
  retryLabel: 'Try again',
})
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-4 px-6 py-14 text-center" role="alert">
    <div class="bg-denied-bg text-denied grid size-12 place-items-center rounded-2xl">
      <TriangleAlert class="size-5.5" />
    </div>
    <div>
      <p class="text-ink text-[15px] font-medium">{{ title }}</p>
      <p v-if="message" class="text-muted mt-1 max-w-sm text-[13px]">{{ message }}</p>
    </div>
    <BaseButton variant="secondary" @click="$emit('retry')">
      <template #icon><RotateCw class="size-4" /></template>
      {{ retryLabel }}
    </BaseButton>
  </div>
</template>
