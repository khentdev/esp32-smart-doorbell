import { readonly, ref } from 'vue'
import { API_URL } from '@/api/axios/axiosConfig'
import { authService } from '@/stores/auth/service'
import { useDashboardStore } from '@/stores/dashboard/dashboardStore'
import { useSoundStore } from '@/stores/settings/soundStore'
import { useToast, type ToastKind } from '@/composables/Toast'
import { getFingerprint } from '@/utils/getFingerprint'
import { formatDateTime } from '@/utils/formatDate'
import type { AccessEventDTO, AccessOutcome } from '@/types/api'

export type StreamStatus = 'connecting' | 'live' | 'disconnected'

const PROBE_AFTER_FAILURES = 3

const toastFor: Record<AccessOutcome, { kind: ToastKind; title: string }> = {
  GRANTED: { kind: 'granted', title: 'Access granted' },
  DENIED: { kind: 'denied', title: 'Access denied' },
  ADMIN_UNLOCK: { kind: 'admin', title: 'Admin unlock' },
}

// Module-level singleton: the navbar badge and the dashboard share one connection.
const status = ref<StreamStatus>('disconnected')
let source: EventSource | null = null
let starting = false

export function useDoorStream() {
  const dashboard = useDashboardStore()
  const sound = useSoundStore()
  const toast = useToast()

  function handleEvent(event: AccessEventDTO) {
    if (!dashboard.applyEvent(event)) return
    const { kind, title } = toastFor[event.outcome]
    toast.show({
      kind,
      title,
      message: `${event.deviceLabel} · ${formatDateTime(event.timestamp)}`,
    })
    sound.playSaved()
  }

  async function start() {
    if (source || starting) return
    starting = true
    status.value = 'connecting'
    try {
      const fingerprint = await getFingerprint()
      const es = new EventSource(
        `${API_URL}/door/stream?fingerprint=${encodeURIComponent(fingerprint)}`,
        { withCredentials: true },
      )
      source = es

      let hasOpened = false
      let failures = 0

      es.onopen = () => {
        failures = 0
        status.value = 'live'
        // Reconnect: catch up through REST, no replay toasts.
        if (hasOpened) void dashboard.fetchSummary({ silent: true })
        hasOpened = true
      }

      es.onerror = () => {
        status.value = 'disconnected'
        // EventSource hides the status code; if it keeps failing, ask /session/me whether the
        // session ended (the axios interceptor sends the user to Login on a 401).
        if (++failures % PROBE_AFTER_FAILURES === 0) void authService.getSession().catch(() => {})
      }

      es.addEventListener('access', (msg) => {
        handleEvent(JSON.parse((msg as MessageEvent<string>).data) as AccessEventDTO)
      })
    } finally {
      starting = false
    }
  }

  function stop() {
    source?.close()
    source = null
    status.value = 'disconnected'
  }

  return { status: readonly(status), start, stop }
}
