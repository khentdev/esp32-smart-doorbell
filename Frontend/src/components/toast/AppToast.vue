<script setup lang="ts">
import type { Component } from 'vue'
import { Check, CircleCheck, CircleX, Info, LockOpen, TriangleAlert, X } from '@lucide/vue'
import { useToast, type ToastKind } from '@/composables/Toast'

const { toasts, dismiss } = useToast()

const look: Record<ToastKind, { icon: Component; chip: string }> = {
  granted: { icon: CircleCheck, chip: 'bg-granted-bg text-granted' },
  denied: { icon: CircleX, chip: 'bg-denied-bg text-denied' },
  admin: { icon: LockOpen, chip: 'bg-admin-bg text-admin' },
  success: { icon: Check, chip: 'bg-granted-bg text-granted' },
  error: { icon: TriangleAlert, chip: 'bg-denied-bg text-denied' },
  info: { icon: Info, chip: 'bg-info-bg text-info' },
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:justify-end sm:px-6"
    aria-live="polite"
    aria-atomic="false"
  >
    <TransitionGroup tag="ul" name="toast" class="flex w-full max-w-sm flex-col gap-2.5">
      <li
        v-for="t in toasts"
        :key="t.id"
        class="border-line bg-surface shadow-float pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5"
        role="status"
      >
        <span class="grid size-9 shrink-0 place-items-center rounded-xl" :class="look[t.kind].chip">
          <component :is="look[t.kind].icon" class="size-4.5" />
        </span>
        <div class="min-w-0 flex-1 pt-px">
          <p class="text-ink text-sm font-semibold">{{ t.title }}</p>
          <p v-if="t.message" class="text-muted mt-0.5 text-[13px] leading-snug">{{ t.message }}</p>
        </div>
        <button
          class="text-muted hover:bg-surface-2 hover:text-ink -m-1 grid size-8 shrink-0 place-items-center rounded-lg"
          aria-label="Dismiss notification"
          @click="dismiss(t.id)"
        >
          <X class="size-4" />
        </button>
      </li>
    </TransitionGroup>
  </div>
</template>
