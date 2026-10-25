<script setup lang="ts">
import { computed } from 'vue'
import { Clock, ShieldCheck, ShieldX } from '@lucide/vue'
import StatCard from './StatCard.vue'
import { useDashboardStore } from '@/stores/dashboard/dashboardStore'
import { useRelativeTime } from '@/composables/useRelativeTime'

const dashboard = useDashboardStore()
const lastEvent = useRelativeTime(() => dashboard.lastEventAt)
const loading = computed(() => dashboard.loadingStates.summary && !dashboard.hasLoaded)
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
    <StatCard
      label="Granted Today"
      :value="String(dashboard.grantedToday)"
      :icon="ShieldCheck"
      tone="granted"
      :loading="loading"
    />
    <StatCard
      label="Denied Today"
      :value="String(dashboard.deniedToday)"
      :icon="ShieldX"
      tone="denied"
      :loading="loading"
    />
    <StatCard
      class="col-span-2 md:col-span-1"
      label="Last Event"
      :value="lastEvent"
      :icon="Clock"
      :loading="loading"
    />
  </div>
</template>
