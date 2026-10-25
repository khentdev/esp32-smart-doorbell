<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ title: string; description?: string; icon?: Component }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
    <div v-if="icon" class="bg-surface-2 text-muted grid size-12 place-items-center rounded-2xl">
      <component :is="icon" class="size-5.5" />
    </div>
    <div>
      <p class="text-ink text-[15px] font-medium">{{ title }}</p>
      <p v-if="description" class="text-muted mt-1 text-[13px]">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
