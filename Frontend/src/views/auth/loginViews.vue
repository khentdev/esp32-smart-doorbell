<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { DoorClosed } from '@lucide/vue'
import BaseInput from '@/components/shared/BaseInput.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import { useAuthStore } from '@/stores/auth/authStore'

const auth = useAuthStore()
const router = useRouter()
const form = reactive({ username: '', password: '' })

async function submit() {
  if (await auth.login(form.username, form.password)) {
    await router.replace({ name: 'dashboard' })
  }
}
</script>

<template>
  <main
    class="grid min-h-dvh place-items-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
  >
    <div class="w-full max-w-sm">
      <div class="mb-8 flex flex-col items-center text-center">
        <span
          class="bg-accent text-accent-fg shadow-float mb-5 grid size-14 place-items-center rounded-2xl"
        >
          <DoorClosed class="size-7" />
        </span>
        <h1 class="text-ink text-2xl font-semibold tracking-tight">Smart Door</h1>
        <p class="text-muted mt-1.5 text-sm">Sign in to manage your door.</p>
      </div>

      <form
        class="border-line bg-surface shadow-card flex flex-col gap-4 rounded-2xl border p-6"
        novalidate
        @submit.prevent="submit"
      >
        <BaseInput
          v-model="form.username"
          label="Username"
          autocomplete="username"
          :error="auth.formErrors.username"
        />
        <BaseInput
          v-model="form.password"
          label="Password"
          type="password"
          autocomplete="current-password"
          :error="auth.formErrors.password"
        />

        <p
          v-if="auth.formErrors.general"
          class="bg-denied-bg text-denied rounded-xl px-3.5 py-2.5 text-[13px]"
          role="alert"
        >
          {{ auth.formErrors.general }}
        </p>

        <BaseButton type="submit" size="lg" block :loading="auth.loadingStates.login" class="mt-1">
          Sign in
        </BaseButton>
      </form>
    </div>
  </main>
</template>
