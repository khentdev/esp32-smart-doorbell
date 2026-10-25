<script setup lang="ts">
import { onMounted } from 'vue'
import StatCards from '@/components/dashboard/StatCards.vue'
import AccessHistory from '@/components/dashboard/AccessHistory.vue'
import BasePanel from '@/components/shared/BasePanel.vue'
import BaseErrorState from '@/components/shared/BaseErrorState.vue'
import { useDashboardStore } from '@/stores/dashboard/dashboardStore'
import { useAuthStore } from '@/stores/auth/authStore'

const dashboard = useDashboardStore()
const auth = useAuthStore()

onMounted(() => dashboard.fetchSummary())
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-ink text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p class="text-muted mt-1 text-sm">
        Welcome back<span v-if="auth.user">, {{ auth.user.username }}</span
        >. Here's the door at a glance.
      </p>
    </div>

    <BasePanel v-if="dashboard.errorStates.summary && !dashboard.hasLoaded">
      <BaseErrorState
        title="Couldn't load the dashboard"
        :message="dashboard.errorStates.summary.message"
        @retry="dashboard.fetchSummary()"
      />
    </BasePanel>

    <template v-else>
      <StatCards />
      <AccessHistory />
    </template>
  </div>
</template>
