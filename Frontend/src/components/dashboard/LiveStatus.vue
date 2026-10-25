<script setup lang="ts">
import { computed } from 'vue'
import { useDoorStream } from '@/composables/useDoorStream'

const { status } = useDoorStream()

const view = computed(() => {
  switch (status.value) {
    case 'live':
      return { label: 'Live', dot: 'text-granted bg-granted live-dot', text: 'text-granted' }
    case 'connecting':
      return { label: 'Connecting', dot: 'text-muted bg-muted', text: 'text-muted' }
    default:
      return { label: 'Disconnected', dot: 'text-denied bg-denied', text: 'text-denied' }
  }
})
</script>

<template>
  <span
    class="border-line bg-surface inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium"
    :class="view.text"
    role="status"
    :aria-label="`Connection: ${view.label}`"
  >
    <span class="size-2 rounded-full" :class="view.dot" />
    {{ view.label }}
  </span>
</template>
