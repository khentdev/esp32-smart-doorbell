import { getThumbmark } from '@thumbmarkjs/thumbmarkjs'

const STORAGE_KEY = 'fingerprint'
let cached: string | null = null
let pending: Promise<string> | null = null

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function store(value: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* storage unavailable: keep the in-memory copy */
  }
}

/**
 * Canonical JSON string of the browser fingerprint (same string on every call).
 * The backend only needs a non-empty JSON object, so we send `{ "thumbmark": "<hash>" }`.
 */
export async function getFingerprint(): Promise<string> {
  if (cached) return cached
  const stored = readStored()
  if (stored) return (cached = stored)

  pending ??= getThumbmark()
    .then(({ thumbmark }) => JSON.stringify({ thumbmark }))
    .then((value) => {
      cached = value
      store(value)
      return value
    })
    .finally(() => {
      pending = null
    })
  return pending
}

/** Drops the cached value so the next call recomputes it (used after `INVALID_DEVICE_ID`). */
export function resetFingerprint() {
  cached = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
