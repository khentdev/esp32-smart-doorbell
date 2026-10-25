<script setup lang="ts">
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <section class="border-line bg-surface shadow-card rounded-2xl border">
    <header
      v-if="title || $slots.header"
      class="border-line flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6"
    >
      <slot name="header">
        <div class="min-w-0">
          <h2 class="text-ink text-[15px] font-semibold">{{ title }}</h2>
          <p v-if="description" class="text-muted mt-0.5 text-[13px]">{{ description }}</p>
        </div>
      </slot>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
