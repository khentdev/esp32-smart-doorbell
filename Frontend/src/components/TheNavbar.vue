<script setup lang="ts">
import { LogOut, Settings, DoorClosed } from '@lucide/vue'
import { RouterLink, useRouter } from 'vue-router'
import LiveStatus from '@/components/dashboard/LiveStatus.vue'
import UnlockButton from '@/components/dashboard/UnlockButton.vue'
import { useAuthStore } from '@/stores/auth/authStore'
import { useDashboardStore } from '@/stores/dashboard/dashboardStore'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  dashboard.reset()
  await router.replace({ name: 'login' })
}

const iconLink =
  'grid size-11 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink'
</script>

<template>
  <header
    class="border-line bg-bg/80 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md"
  >
    <div class="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="mr-auto flex items-center gap-2.5"
        aria-label="Dashboard"
      >
        <span
          class="bg-accent text-accent-fg shadow-card grid size-9 place-items-center rounded-xl"
        >
          <DoorClosed class="size-5" />
        </span>
        <span class="text-ink hidden text-[15px] font-semibold tracking-tight sm:block">
          Smart Door
        </span>
      </RouterLink>

      <LiveStatus />
      <UnlockButton />

      <nav class="flex items-center">
        <RouterLink
          :to="{ name: 'settings' }"
          :class="iconLink"
          active-class="bg-surface-2 text-ink"
          aria-label="Settings"
        >
          <Settings class="size-5" />
        </RouterLink>
        <button
          :class="iconLink"
          :disabled="auth.loadingStates.logout"
          aria-label="Log out"
          @click="logout"
        >
          <LogOut class="size-5" />
        </button>
      </nav>
    </div>
  </header>
</template>
