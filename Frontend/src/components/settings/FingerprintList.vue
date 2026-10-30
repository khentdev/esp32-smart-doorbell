<script setup lang="ts">
import { FingerprintPattern } from '@lucide/vue'
import FingerprintListItem from './FingerprintListItem.vue'
import BaseEmptyState from '@/components/shared/BaseEmptyState.vue'
import BaseErrorState from '@/components/shared/BaseErrorState.vue'
import { useFingerprintStore } from '@/stores/fingerprints/fingerprintStore'

const store = useFingerprintStore()
</script>

<template>
  <ul
    v-if="store.loadingStates.list && !store.hasLoaded"
    class="divide-line divide-y"
    aria-hidden="true"
  >
    <li v-for="n in 2" :key="n" class="flex items-center gap-4 px-5 py-3.5 sm:px-6">
      <div class="skeleton size-10 rounded-xl" />
      <div class="flex-1 space-y-2">
        <div class="skeleton h-3.5 w-28 rounded" />
        <div class="skeleton h-3 w-40 rounded" />
      </div>
    </li>
  </ul>

  <BaseErrorState
    v-else-if="store.errorStates.list"
    title="Couldn't load fingerprints"
    :message="store.errorStates.list.message"
    @retry="store.fetch()"
  />

  <BaseEmptyState
    v-else-if="store.fingerprints.length === 0"
    title="No fingerprints enrolled yet"
    description="Add someone below to let them open the door."
    :icon="FingerprintPattern"
  />

  <TransitionGroup v-else tag="ul" name="list" class="divide-line divide-y">
    <FingerprintListItem v-for="f in store.fingerprints" :key="f.id" :fingerprint="f" />
  </TransitionGroup>
</template>
