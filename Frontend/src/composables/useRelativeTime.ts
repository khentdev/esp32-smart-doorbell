import { computed, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { IsoDateString } from '@/types/api'
import { formatRelative } from '@/utils/formatDate'

/** Relative label ("5 minutes ago") that ticks once a minute; `—` when there is no value. */
export function useRelativeTime(iso: MaybeRefOrGetter<IsoDateString | null>) {
  const now = ref(Date.now())
  const timer = setInterval(() => (now.value = Date.now()), 60_000)
  onScopeDispose(() => clearInterval(timer))

  return computed(() => {
    const value = toValue(iso)
    return value ? formatRelative(value, now.value) : '—'
  })
}
