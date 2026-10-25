<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppToast from '@/components/toast/AppToast.vue'
import SessionOverlay from '@/components/system/SessionOverlay.vue'
import { useNetworkStatus } from '@/composables/useNetworkStatus'

useNetworkStatus()
</script>

<template>
  <RouterView />
  <SessionOverlay />
  <AppToast />
</template>
