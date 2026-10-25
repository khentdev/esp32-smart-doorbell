<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'

const props = defineProps<{
  label: string
  type?: 'text' | 'password'
  error?: string
  autocomplete?: string
  placeholder?: string
}>()

const model = defineModel<string>({ default: '' })
const id = useId()
const reveal = ref(false)

const isPassword = computed(() => props.type === 'password')
const inputType = computed(() =>
  isPassword.value && reveal.value ? 'text' : (props.type ?? 'text'),
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-ink text-sm font-medium">{{ label }}</label>
    <div class="relative">
      <input
        :id="id"
        v-model="model"
        :type="inputType"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="bg-surface text-ink placeholder:text-muted/70 focus:border-accent h-12 w-full rounded-xl border px-3.5 text-base transition-colors focus:ring-4 focus:ring-(--ring) focus:outline-none"
        :class="[error ? 'border-denied' : 'border-line', isPassword && 'pr-12']"
      />
      <button
        v-if="isPassword"
        type="button"
        class="text-muted hover:text-ink absolute inset-y-0 right-0 grid w-12 place-items-center"
        :aria-label="reveal ? 'Hide password' : 'Show password'"
        @click="reveal = !reveal"
      >
        <EyeOff v-if="reveal" class="size-4.5" />
        <Eye v-else class="size-4.5" />
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="text-denied text-[13px]" role="alert">{{ error }}</p>
  </div>
</template>
