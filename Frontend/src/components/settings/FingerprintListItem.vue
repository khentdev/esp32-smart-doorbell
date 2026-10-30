<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { Pencil, Trash } from '@lucide/vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import BaseSpinner from '@/components/shared/BaseSpinner.vue'
import { useFingerprintStore } from '@/stores/fingerprints/fingerprintStore'
import { formatDateTime } from '@/utils/formatDate'
import type { FingerprintDTO } from '@/types/api'

const props = defineProps<{ fingerprint: FingerprintDTO }>()

const store = useFingerprintStore()
const mode = ref<'view' | 'rename' | 'confirm'>('view')
const draft = ref('')
const renameError = ref('')
const input = useTemplateRef<HTMLInputElement>('input')

const removing = computed(
  () =>
    store.activeJob?.type === 'DELETE' && store.activeJob.fingerprintId === props.fingerprint.id,
)
const busy = computed(() => store.activeJob !== null || store.loadingStates.remove !== null)

async function startRename() {
  draft.value = props.fingerprint.name
  renameError.value = ''
  mode.value = 'rename'
  await nextTick()
  input.value?.select()
}

async function saveRename() {
  const name = draft.value.trim()
  if (name === props.fingerprint.name) return void (mode.value = 'view')
  if (!name) return void (renameError.value = 'Enter a name.')
  const error = await store.rename(props.fingerprint.id, name)
  if (error) renameError.value = error
  else mode.value = 'view'
}

async function confirmRemove() {
  await store.remove(props.fingerprint.id)
  mode.value = 'view'
}
</script>

<template>
  <li class="flex flex-col gap-3 px-5 py-3.5 sm:px-6">
    <form v-if="mode === 'rename'" class="flex flex-col gap-1.5" @submit.prevent="saveRename">
      <div class="flex gap-2.5">
        <input
          ref="input"
          v-model="draft"
          aria-label="Name"
          maxlength="40"
          :aria-invalid="!!renameError"
          class="bg-surface text-ink focus:border-accent h-11 min-w-0 flex-1 rounded-xl border px-3.5 text-base focus:ring-4 focus:ring-(--ring) focus:outline-none"
          :class="renameError ? 'border-denied' : 'border-line'"
          @keydown.esc="mode = 'view'"
        />
        <BaseButton variant="ghost" @click="mode = 'view'">Cancel</BaseButton>
        <BaseButton type="submit" :loading="store.loadingStates.rename === fingerprint.id">
          Save
        </BaseButton>
      </div>
      <p v-if="renameError" class="text-denied text-[13px]" role="alert">{{ renameError }}</p>
    </form>

    <div v-else class="flex items-center gap-3.5 sm:gap-4">
      <span
        class="bg-info-bg text-info grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold uppercase"
        aria-hidden="true"
      >
        {{ fingerprint.name.charAt(0) }}
      </span>

      <div class="min-w-0 flex-1">
        <p class="text-ink truncate text-sm font-medium">{{ fingerprint.name }}</p>
        <p class="text-muted text-[13px]">
          <template v-if="removing">Removing… waiting for the door</template>
          <template v-else-if="mode === 'confirm'"
            >They will no longer be able to open the door.</template
          >
          <template v-else>Added {{ formatDateTime(fingerprint.createdAt) }}</template>
        </p>
      </div>

      <BaseSpinner v-if="removing" class="text-muted size-4" />

      <div v-else-if="mode === 'confirm'" class="flex shrink-0 gap-1.5">
        <BaseButton variant="ghost" @click="mode = 'view'">Cancel</BaseButton>
        <BaseButton
          variant="secondary"
          class="text-denied!"
          :loading="store.loadingStates.remove === fingerprint.id"
          @click="confirmRemove"
        >
          Remove
        </BaseButton>
      </div>

      <div v-else class="flex shrink-0 gap-1">
        <BaseButton
          variant="ghost"
          class="w-11 px-0!"
          :aria-label="`Rename ${fingerprint.name}`"
          @click="startRename"
        >
          <template #icon><Pencil class="size-4" /></template>
        </BaseButton>
        <BaseButton
          variant="ghost"
          class="w-11 px-0!"
          :disabled="busy"
          :aria-label="`Remove ${fingerprint.name}`"
          @click="mode = 'confirm'"
        >
          <template #icon><Trash class="size-4" /></template>
        </BaseButton>
      </div>
    </div>
  </li>
</template>
