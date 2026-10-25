import { watch } from 'vue'
import { useOnline } from '@vueuse/core'
import { useToast } from '@/composables/Toast'

/** Mounts once at the app root: toasts when connectivity is lost or restored. */
export function useNetworkStatus() {
  const online = useOnline()
  const toast = useToast()

  watch(online, (isOnline) => {
    if (isOnline) toast.success('Back online')
    else toast.error("You're offline", 'Live updates will resume when you reconnect.')
  })

  return { online }
}
