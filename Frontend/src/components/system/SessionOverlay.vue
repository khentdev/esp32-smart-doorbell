<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { DoorClosed } from '@lucide/vue'
import BaseSpinner from '@/components/shared/BaseSpinner.vue'
import BaseErrorState from '@/components/shared/BaseErrorState.vue'
import { useAuthStore } from '@/stores/auth/authStore'

const auth = useAuthStore()
const router = useRouter()

// Only cover the screen while restoring the session on app load, not on later checks.
const visible = computed(() => auth.sessionState === 'loading' || auth.sessionState === 'error')

/** Re-run navigation so the route guard restores the session again. */
function retry() {
  void router.replace(window.location.pathname + window.location.search)
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="bg-bg fixed inset-0 z-40 grid place-items-center px-4"
      :aria-busy="auth.sessionState === 'loading'"
    >
      <div
        v-if="auth.sessionState === 'loading'"
        class="text-muted flex flex-col items-center gap-4"
      >
        <div
          class="bg-accent text-accent-fg shadow-card grid size-12 place-items-center rounded-2xl"
        >
          <DoorClosed class="size-6" />
        </div>
        <div class="flex items-center gap-2 text-sm">
          <BaseSpinner class="size-4" />
          Restoring your session…
        </div>
      </div>
      <BaseErrorState
        v-else
        title="Can't reach the server"
        message="Check your connection and that the API is running, then try again."
        @retry="retry"
      />
    </div>
  </Transition>
</template>
