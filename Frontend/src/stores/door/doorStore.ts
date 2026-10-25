import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { doorService } from './service'
import { errorHandler } from '@/api/errors/errorHandler'
import { useToast } from '@/composables/Toast'

const COOLDOWN_MS = 3000

export const useDoorStore = defineStore('door', () => {
  const toast = useToast()
  const loadingStates = reactive({ unlock: false })
  const cooldown = reactive({ active: false })

  /** Queues a manual unlock. The door opens ~3s later; the result arrives via the live stream. */
  async function unlock() {
    if (loadingStates.unlock || cooldown.active) return
    loadingStates.unlock = true
    try {
      await doorService.unlock({ deviceId: 'front_gate' })
      toast.success('Unlock requested', 'The door will open in a few seconds.')
      cooldown.active = true
      setTimeout(() => (cooldown.active = false), COOLDOWN_MS)
    } catch (err) {
      const { code, message, status } = errorHandler(err)
      // A 401 is already routed to Login by the axios interceptor.
      if (status !== 401) {
        toast.error(
          code === 'DOOR_UNLOCK_SERVER_ERROR' ? "Couldn't request unlock" : 'Unlock failed',
          message,
        )
      }
    } finally {
      loadingStates.unlock = false
    }
  }

  return { loadingStates, cooldown, unlock }
})
