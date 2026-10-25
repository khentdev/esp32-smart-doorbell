<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string
  icon: Component
  tone?: 'granted' | 'denied' | 'neutral'
  loading?: boolean
}>()
</script>

<template>
  <div class="border-line bg-surface shadow-card rounded-2xl border p-5">
    <div class="flex items-center justify-between">
      <p class="text-muted text-[13px] font-medium">{{ label }}</p>
      <span
        class="grid size-8 place-items-center rounded-lg"
        :class="{
          'bg-granted-bg text-granted': tone === 'granted',
          'bg-denied-bg text-denied': tone === 'denied',
          'bg-info-bg text-info': !tone || tone === 'neutral',
        }"
      >
        <component :is="icon" class="size-4" />
      </span>
    </div>
    <div v-if="loading" class="skeleton mt-3 h-9 w-20 rounded-lg" aria-hidden="true" />
    <p
      v-else
      class="text-ink mt-2 text-3xl font-semibold tracking-tight tabular-nums"
      :class="value.length > 6 && 'text-2xl leading-[2.25rem]'"
    >
      {{ value }}
    </p>
  </div>
</template>
