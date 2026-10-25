import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { dashboardService } from './service'
import { errorHandler } from '@/api/errors/errorHandler'
import type { ErrorResponse } from '@/api/errors'
import type { AccessEventDTO, IsoDateString } from '@/types/api'

const HISTORY_LIMIT = 30

export const useDashboardStore = defineStore('dashboard', () => {
  const grantedToday = ref(0)
  const deniedToday = ref(0)
  const lastEventAt = ref<IsoDateString | null>(null)
  const history = ref<AccessEventDTO[]>([])
  const hasLoaded = ref(false)

  const loadingStates = reactive({ summary: false })
  const errorStates = reactive<{ summary: ErrorResponse | null }>({ summary: null })

  /** `silent` skips the skeleton (used for SSE reconnect catch-up). */
  async function fetchSummary({ silent = false } = {}) {
    if (!silent) loadingStates.summary = true
    errorStates.summary = null
    try {
      const summary = await dashboardService.getSummary()
      grantedToday.value = summary.accessGrantedToday
      deniedToday.value = summary.accessDeniedToday
      lastEventAt.value = summary.lastEventAt
      history.value = summary.recentHistory
      hasLoaded.value = true
    } catch (err) {
      // A failed silent refresh keeps showing the data we already have.
      if (!silent || !hasLoaded.value) errorStates.summary = errorHandler(err)
    } finally {
      loadingStates.summary = false
    }
  }

  /** Applies one live event: prepend (cap 30), bump counters, update last event. */
  function applyEvent(event: AccessEventDTO) {
    if (history.value.some((e) => e.id === event.id)) return false
    history.value = [event, ...history.value].slice(0, HISTORY_LIMIT)
    if (event.outcome === 'DENIED') deniedToday.value++
    else grantedToday.value++ // GRANTED and ADMIN_UNLOCK both count as granted
    lastEventAt.value = event.timestamp
    return true
  }

  function reset() {
    grantedToday.value = 0
    deniedToday.value = 0
    lastEventAt.value = null
    history.value = []
    errorStates.summary = null
    hasLoaded.value = false
  }

  return {
    grantedToday,
    deniedToday,
    lastEventAt,
    history,
    hasLoaded,
    loadingStates,
    errorStates,
    fetchSummary,
    applyEvent,
    reset,
  }
})
