<script setup lang="ts">
import { computed } from 'vue'
import { LockOpen } from '@lucide/vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import { useDoorStore } from '@/stores/door/doorStore'

const door = useDoorStore()
const busy = computed(() => door.loadingStates.unlock || door.cooldown.active)
</script>

<template>
  <BaseButton :loading="busy" aria-label="Unlock door" @click="door.unlock()">
    <template #icon><LockOpen class="size-4" /></template>
    <span class="hidden sm:inline">Unlock Door</span>
  </BaseButton>
</template>
