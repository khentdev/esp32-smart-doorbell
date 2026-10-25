<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import TheNavbar from '@/components/TheNavbar.vue'
import { useDoorStream } from '@/composables/useDoorStream'
import { useSoundStore } from '@/stores/settings/soundStore'

const stream = useDoorStream()
const sound = useSoundStore()

// One live connection for the whole authenticated area; closed on logout/unmount.
onMounted(() => {
  void sound.load()
  void stream.start()
})
onBeforeUnmount(() => stream.stop())
</script>

<template>
  <div class="min-h-dvh">
    <TheNavbar />
    <main
      class="mx-auto max-w-5xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-6 sm:pt-8"
    >
      <RouterView />
    </main>
  </div>
</template>
