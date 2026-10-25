<script setup lang="ts">
import { BellOff } from '@lucide/vue'
import AccessHistoryItem from './AccessHistoryItem.vue'
import BasePanel from '@/components/shared/BasePanel.vue'
import BaseEmptyState from '@/components/shared/BaseEmptyState.vue'
import { useDashboardStore } from '@/stores/dashboard/dashboardStore'

const dashboard = useDashboardStore()
</script>

<template>
  <BasePanel title="Access history" description="Latest 30 events, newest first">
    <ul
      v-if="dashboard.loadingStates.summary && !dashboard.hasLoaded"
      class="divide-line divide-y"
      aria-hidden="true"
    >
      <li v-for="n in 5" :key="n" class="flex items-center gap-4 px-5 py-3.5 sm:px-6">
        <div class="skeleton size-10 rounded-xl" />
        <div class="flex-1 space-y-2">
          <div class="skeleton h-3.5 w-28 rounded" />
          <div class="skeleton h-3 w-40 rounded" />
        </div>
        <div class="skeleton h-6 w-16 rounded-full" />
      </li>
    </ul>

    <BaseEmptyState
      v-else-if="dashboard.history.length === 0"
      title="No notifications yet"
      description="Fingerprint scans and unlocks will show up here live."
      :icon="BellOff"
    />

    <TransitionGroup v-else tag="ul" name="list" class="divide-line divide-y" aria-live="polite">
      <AccessHistoryItem v-for="event in dashboard.history" :key="event.id" :event="event" />
    </TransitionGroup>
  </BasePanel>
</template>
