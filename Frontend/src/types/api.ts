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
  fingerprintName: string | null // enrolled person's name at scan time; null if not GRANTED or not enrolled
  timestamp: IsoDateString // server-stamped
}

/** One enrolled person (one finger in one sensor slot). */
export type FingerprintDTO = {
  id: string // uuid
  deviceId: DeviceId
  name: string // 1–40 chars, unique per device (case-insensitive)
  slot: number // 1–127, assigned by the backend
  createdAt: IsoDateString
}

export type FingerprintJobType = 'ENROLL' | 'DELETE'
export type FingerprintJobStatus = 'PENDING' | 'SENT' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'
export type FingerprintJobStep = 'PLACE_FINGER' | 'REMOVE_FINGER' | 'PLACE_AGAIN'
export type FingerprintJobError =
  | 'MISMATCH' // the two scans didn't match
  | 'TIMEOUT' // nobody placed a finger in time
  | 'BAD_IMAGE' // the sensor couldn't read the finger
  | 'STORE_FAILED' // the sensor couldn't save the template
  | 'DELETE_FAILED' // the sensor couldn't wipe the slot
  | 'DEVICE_TIMEOUT' // the ESP32 took the job but never reported back (set by the backend)

/** One enroll/delete request travelling to the ESP32 and back. */
export type FingerprintJobDTO = {
  id: string // uuid
  deviceId: DeviceId
  type: FingerprintJobType
  status: FingerprintJobStatus
  step: FingerprintJobStep | null // last step the ESP32 reported
  error: FingerprintJobError | null // set only when status is "FAILED"
  name: string // the person's name, for display
  slot: number
  fingerprintId: string | null // DELETE only
  createdAt: IsoDateString
  updatedAt: IsoDateString
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

/** Named SSE event `access`. `data` is JSON of AccessEventDTO. */
export type AccessStreamEvent = {
  event: 'access'
  data: AccessEventDTO
}

/** Named SSE event `fingerprint`, sent on every fingerprint job change. */
export type FingerprintJobEventDTO = {
  job: FingerprintJobDTO
  fingerprint: FingerprintDTO | null // the new person, only on a SUCCEEDED ENROLL
}

export type FingerprintStreamEvent = {
  event: 'fingerprint'
  data: FingerprintJobEventDTO
}

// ---------- GET /fingerprints ----------

export type ListFingerprintsQuery = {
  deviceId: DeviceId
}

export type ListFingerprintsResponse = {
  fingerprints: FingerprintDTO[] // oldest first
  activeJob: FingerprintJobDTO | null // PENDING or SENT job, if any
}

// ---------- POST /fingerprints ----------

export type EnrollFingerprintRequest = {
  deviceId: DeviceId
  name: string
}

export type EnrollFingerprintResponse = FingerprintJobDTO // type "ENROLL", status "PENDING"

// ---------- PATCH /fingerprints/:id ----------

export type RenameFingerprintRequest = {
  name: string
}

export type RenameFingerprintResponse = FingerprintDTO

// ---------- DELETE /fingerprints/:id ----------

export type DeleteFingerprintResponse = FingerprintJobDTO // type "DELETE", status "PENDING"

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

export type PollDeviceCommandResponse =
  | { command: null }
  | { command: 'UNLOCK' }
  | { command: 'ENROLL' | 'DELETE'; jobId: string; slot: number }

export type ReportJobProgressRequest =
  | { deviceId: DeviceId; step: FingerprintJobStep | 'SUCCEEDED' }
  | { deviceId: DeviceId; step: 'FAILED'; error: Exclude<FingerprintJobError, 'DEVICE_TIMEOUT'> }

export type ReportJobProgressResponse = FingerprintJobDTO

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
  // fingerprints
  | 'FINGERPRINT_NOT_FOUND'
  | 'FINGERPRINT_NAME_TAKEN'
  | 'FINGERPRINT_SLOTS_FULL'
  | 'FINGERPRINT_JOB_IN_PROGRESS'
  | 'FINGERPRINT_JOB_NOT_FOUND'
  | 'FINGERPRINT_JOB_NOT_ACTIVE'
  | 'FINGERPRINT_SERVER_ERROR'
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
