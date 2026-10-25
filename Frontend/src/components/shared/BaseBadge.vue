<script setup lang="ts">
defineProps<{ tone?: 'granted' | 'denied' | 'admin' | 'neutral' }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    :class="{
      'bg-granted-bg text-granted': tone === 'granted',
      'bg-denied-bg text-denied': tone === 'denied',
      'bg-admin-bg text-admin': tone === 'admin',
      'bg-info-bg text-info': !tone || tone === 'neutral',
    }"
  >
    <slot />
  </span>
</template>
