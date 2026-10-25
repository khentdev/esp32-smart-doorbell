<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Compass } from '@lucide/vue'
</script>

<template>
  <main class="grid min-h-dvh place-items-center px-4 text-center">
    <div class="flex flex-col items-center gap-4">
      <span class="bg-surface-2 text-muted grid size-14 place-items-center rounded-2xl">
        <Compass class="size-7" />
      </span>
      <div>
        <h1 class="text-ink text-2xl font-semibold tracking-tight">Page not found</h1>
        <p class="text-muted mt-1.5 text-sm">The page you're looking for doesn't exist.</p>
      </div>
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="bg-accent text-accent-fg shadow-card hover:bg-accent-hover inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium"
      >
        Back to dashboard
      </RouterLink>
    </div>
  </main>
</template>
