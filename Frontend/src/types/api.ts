// ============================================================
// Frontend/src/types/api.ts — copied from docs "API Contract"
// ============================================================

// ---------- Primitives ----------

/** ISO 8601 UTC string, e.g. "2026-08-05T02:30:00.000Z". Convert to local time for display. */
export type IsoDateString = string

export type AccessOutcome = 'GRANTED' | 'DENIED' | 'ADMIN_UNLOCK'

/** Keys of the backend device label map (`config/devices.ts`). */
export type DeviceId = 'front_gate'

// ---------- Shared DTOs ----------

export type UserDTO = {
  username: string
}

/** One access attempt. Same shape in /dashboard/summary history, /door/stream events and POST /door/access. */
export type AccessEventDTO = {
  id: string // uuid
  deviceId: DeviceId
  deviceLabel: string // e.g. "Front Gate"
  outcome: AccessOutcome
  fingerprintSlot: number | null // sensor slot; set only when outcome is "GRANTED"
  timestamp: IsoDateString // server-stamped
}

// ---------- Headers ----------

export type FingerprintHeader = {
  'X-Fingerprint': string // canonical JSON string of the browser fingerprint
}

/** Required on every authenticated REST call (not on /door/stream). */
export type AuthedHeaders = FingerprintHeader & {
  'X-CSRF-Token': string // value of the csrfToken cookie
}

// ---------- POST /auth/login ----------

export type LoginRequest = {
  username: string
  password: string
}

export type LoginResponse = {
  user: UserDTO
  message: string // "Logged in successfully"
}

// ---------- GET /session/me ----------

export type SessionResponse = {
  user: UserDTO
}

// ---------- DELETE /session/logout ----------

export type LogoutResponse = {
  message: string // "Logged out successfully."
}

// ---------- GET /dashboard/summary ----------

export type DashboardSummaryResponse = {
  accessGrantedToday: number // UTC day; includes ADMIN_UNLOCK
  accessDeniedToday: number // UTC day
  lastEventAt: IsoDateString | null // null when there are no events yet
  recentHistory: AccessEventDTO[] // newest first, max 30
}

// ---------- POST /door/unlock ----------

export type ManualDoorUnlockRequest = {
  deviceId: DeviceId
}

export type ManualDoorUnlockResponse = {
  status: 'UNLOCK_REQUESTED'
}

// ---------- GET /door/stream (SSE) ----------

export type DoorStreamQuery = {
  fingerprint: string // same string as X-Fingerprint, URL-encoded
}

/** The only named SSE event. `data` is JSON of AccessEventDTO. */
export type AccessStreamEvent = {
  event: 'access'
  data: AccessEventDTO
}

// ---------- GET /healthz ----------

export type HealthResponse = {
  status: string
}

// ---------- ESP32-only endpoints (the dashboard never calls these) ----------

export type DeviceApiKeyHeader = {
  'X-API-Key': string
}

export type ReportAccessRequest =
  | { deviceId: DeviceId; outcome: 'GRANTED'; fingerprintSlot: number } // integer >= 0
  | { deviceId: DeviceId; outcome: 'DENIED' | 'ADMIN_UNLOCK'; fingerprintSlot?: null }

export type ReportAccessResponse = AccessEventDTO

export type PollCommandQuery = {
  deviceId: DeviceId
}

export type PollDeviceCommandResponse = {
  command: 'UNLOCK' | null
}

// ---------- Errors ----------

export type ApiErrorCode =
  // auth / session
  | 'INVALID_CREDENTIALS'
  | 'INVALID_USERNAME'
  | 'INVALID_PASSWORD'
  | 'INVALID_DEVICE_ID'
  | 'SESSION_UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  // input
  | 'INVALID_BODY'
  | 'VALIDATION_ERROR'
  // door / device
  | 'UNKNOWN_DEVICE_ID'
  | 'DEVICE_UNAUTHORIZED'
  | 'DOOR_UNLOCK_SERVER_ERROR'
  | 'POLL_DEVICE_ERROR'
  | 'ACCESS_EVENT_SERVER_ERROR'
  // dashboard
  | 'DASHBOARD_SUMMARY_ERROR'
  // generic
  | 'SERVER_ERROR'
  | 'NOT_FOUND'

export type ValidationIssue = {
  path: string // e.g. "fingerprintSlot"
  message: string
}

export type ApiError = {
  error: {
    code: ApiErrorCode
    message: string // human-readable, safe to show; do not switch on it
    field?: string // which input/step failed, when known
    data?: Record<string, unknown>
    issues?: ValidationIssue[] // only when code is "VALIDATION_ERROR"
  }
}

/** Any 401 that means "send the user back to Login". */
export const SESSION_ENDED_CODES: ApiErrorCode[] = [
  'SESSION_UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
]
