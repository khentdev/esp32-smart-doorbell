import type { Component } from 'vue'
import { CircleCheck, CircleX, LockOpen } from '@lucide/vue'
import type { AccessOutcome } from '@/types/api'

export type OutcomeMeta = {
  label: string
  tone: 'granted' | 'denied' | 'admin'
  icon: Component
}

/** Colour is never the only cue: every outcome also has its own icon and label. */
export const OUTCOME_META: Record<AccessOutcome, OutcomeMeta> = {
  GRANTED: { label: 'Granted', tone: 'granted', icon: CircleCheck },
  DENIED: { label: 'Denied', tone: 'denied', icon: CircleX },
  ADMIN_UNLOCK: { label: 'Admin unlock', tone: 'admin', icon: LockOpen },
}
