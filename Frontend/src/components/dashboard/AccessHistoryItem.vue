<script setup lang="ts">
import BaseBadge from '@/components/shared/BaseBadge.vue'
import { OUTCOME_META } from '@/utils/outcome'
import { formatDateTime } from '@/utils/formatDate'
import type { AccessEventDTO } from '@/types/api'

const props = defineProps<{ event: AccessEventDTO }>()
const meta = OUTCOME_META[props.event.outcome]

// Name snapshot from scan time; "Slot N" for a slot the database doesn't know.
const person =
  props.event.fingerprintName ??
  (props.event.fingerprintSlot !== null ? `Slot ${props.event.fingerprintSlot}` : null)
</script>

<template>
  <li class="flex items-center gap-3.5 px-5 py-3.5 sm:gap-4 sm:px-6">
    <span
      class="grid size-10 shrink-0 place-items-center rounded-xl"
      :class="{
        'bg-granted-bg text-granted': meta.tone === 'granted',
        'bg-denied-bg text-denied': meta.tone === 'denied',
        'bg-admin-bg text-admin': meta.tone === 'admin',
      }"
    >
      <component :is="meta.icon" class="size-5" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="text-ink truncate text-sm font-medium">
        {{ event.deviceLabel
        }}<span v-if="person" class="text-muted font-normal"> · {{ person }}</span>
      </p>
      <time :datetime="event.timestamp" class="text-muted block text-[13px]">
        {{ formatDateTime(event.timestamp) }}
      </time>
    </div>

    <BaseBadge :tone="meta.tone">{{ meta.label }}</BaseBadge>
  </li>
</template>
