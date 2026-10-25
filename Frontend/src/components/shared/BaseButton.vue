<script setup lang="ts">
import BaseSpinner from './BaseSpinner.vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    block?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    :disabled="loading || disabled"
    class="inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-60"
    :class="[
      size === 'lg' ? 'h-12 px-5 text-[15px]' : 'h-11 px-4 text-sm',
      block && 'w-full',
      variant === 'primary' && 'bg-accent text-accent-fg shadow-card hover:bg-accent-hover',
      variant === 'secondary' &&
        'border-line bg-surface text-ink shadow-card hover:bg-surface-2 border',
      variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-ink',
    ]"
  >
    <BaseSpinner v-if="loading" class="size-4" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
