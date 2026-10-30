<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, CircleCheck, CircleX, UserPlus } from '@lucide/vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import BaseInput from '@/components/shared/BaseInput.vue'
import BaseSpinner from '@/components/shared/BaseSpinner.vue'
import { useFingerprintStore } from '@/stores/fingerprints/fingerprintStore'
import { ENROLL_STEPS, jobFailureMessage } from '@/utils/fingerprintJob'

const MAX_NAME_LENGTH = 40

const store = useFingerprintStore()
const name = ref('')
const nameError = ref('')

const enrollJob = computed(() => (store.activeJob?.type === 'ENROLL' ? store.activeJob : null))
const deleting = computed(() => store.activeJob?.type === 'DELETE')
const result = computed(() => (enrollJob.value ? null : store.lastEnroll))
const failure = computed(() => (result.value ? jobFailureMessage(result.value) : null))

/** -1 while the door hasn't picked the job up yet. */
const currentStep = computed(() => {
  const job = enrollJob.value
  if (!job || job.status === 'PENDING') return -1
  return Math.max(
    0,
    ENROLL_STEPS.findIndex((s) => s.step === job.step),
  )
})

async function submit() {
  nameError.value = ''
  const trimmed = name.value.trim()
  if (!trimmed) return void (nameError.value = 'Enter a name.')
  if (trimmed.length > MAX_NAME_LENGTH) {
    return void (nameError.value = `Use ${MAX_NAME_LENGTH} characters or fewer.`)
  }
  nameError.value = (await store.enroll(trimmed)) ?? ''
}

function retry() {
  name.value = result.value?.name ?? name.value
  store.clearLastEnroll()
  void submit()
}

function finish() {
  store.clearLastEnroll()
  name.value = ''
}
</script>

<template>
  <div class="p-5 sm:p-6">
    <!-- Live progress: mirrors the OLED prompts at the door -->
    <div v-if="enrollJob" aria-live="polite">
      <p class="text-ink text-sm font-medium">Enrolling {{ enrollJob.name }}</p>
      <p class="text-muted mt-0.5 text-[13px]">
        {{
          currentStep < 0
            ? 'Waiting for the door… it picks this up within a few seconds.'
            : 'Follow the prompts at the door.'
        }}
      </p>

      <ol class="mt-4 flex flex-col gap-2.5">
        <li v-for="(s, i) in ENROLL_STEPS" :key="s.step" class="flex items-center gap-3">
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
            :class="
              i < currentStep
                ? 'bg-granted-bg text-granted'
                : i === currentStep
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface-2 text-muted'
            "
          >
            <Check v-if="i < currentStep" class="size-4" />
            <BaseSpinner v-else-if="i === currentStep" class="size-3.5" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="text-sm" :class="i === currentStep ? 'text-ink font-medium' : 'text-muted'">
            {{ s.label }}
          </span>
        </li>
      </ol>
    </div>

    <!-- Result of the enrollment that just finished -->
    <div v-else-if="result" class="flex flex-col gap-4" role="status">
      <div class="flex items-start gap-3">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-xl"
          :class="failure ? 'bg-denied-bg text-denied' : 'bg-granted-bg text-granted'"
        >
          <CircleX v-if="failure" class="size-5" />
          <CircleCheck v-else class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="text-ink text-sm font-medium">
            {{ failure ? `Couldn't enroll ${result.name}` : `${result.name} is enrolled` }}
          </p>
          <p class="text-muted mt-0.5 text-[13px]">
            {{ failure ?? 'They can now open the door with their fingerprint.' }}
          </p>
        </div>
      </div>
      <div class="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <BaseButton v-if="failure" variant="ghost" @click="finish">Cancel</BaseButton>
        <BaseButton v-if="failure" :loading="store.loadingStates.enroll" @click="retry">
          Try again
        </BaseButton>
        <BaseButton v-else variant="secondary" @click="finish">Add another</BaseButton>
      </div>
    </div>

    <!-- Add form -->
    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <BaseInput
        v-model="name"
        label="Name"
        placeholder="e.g. Juan"
        autocomplete="off"
        :error="nameError"
      />
      <p class="text-muted -mt-2 text-[13px]">
        After you click Add, the person scans the same finger twice at the door.
      </p>
      <p v-if="deleting" class="text-muted text-[13px]">
        Wait for the current removal to finish before adding someone.
      </p>
      <div class="flex justify-end">
        <BaseButton
          type="submit"
          class="w-full sm:w-auto"
          :loading="store.loadingStates.enroll"
          :disabled="deleting || !store.hasLoaded"
        >
          <template #icon><UserPlus class="size-4" /></template>
          Add fingerprint
        </BaseButton>
      </div>
    </form>
  </div>
</template>
