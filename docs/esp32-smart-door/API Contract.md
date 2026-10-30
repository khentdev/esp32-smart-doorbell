## API Contract

Copy-paste TypeScript for every endpoint: the request headers and body or query, the response DTO, and the error codes each endpoint can return. Behaviour and security rules live in [[API & Database Reference]]; this page covers request and response shapes only. Types mirror the backend's `Backend-hono/src/features/*/types.ts` and were checked against the controllers and integration tests.

**How to use:** copy the block in §1 into `Frontend/src/types/api.ts`. The endpoint sections in §2 and §3 explain each type and when to call it.

**Base rules for every dashboard call**

- Send every request with `credentials: "include"` so the `sid` and `csrfToken` cookies are sent and stored.
- Read the CSRF token from the `csrfToken` cookie, which JS can read, and send it as `X-CSRF-Token`.
- `X-Fingerprint` is the canonical JSON string of the browser fingerprint, the same string on every call (see [[API & Database Reference#6.3 Device fingerprint]]).
- Errors always use the `ApiError` envelope. Switch on `error.code`, never on `message`.

---

### 1. Types (copy this whole block)

```ts
// ============================================================
// Frontend/src/types/api.ts — copied from docs "API Contract"
// ============================================================

// ---------- Primitives ----------

/** ISO 8601 UTC string, e.g. "2026-08-05T02:30:00.000Z". Convert to local time for display. */
export type IsoDateString = string

export type AccessOutcome = "GRANTED" | "DENIED" | "ADMIN_UNLOCK"

/** Keys of the backend device label map (`config/devices.ts`). */
export type DeviceId = "front_gate"

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

export type FingerprintJobType = "ENROLL" | "DELETE"
export type FingerprintJobStatus = "PENDING" | "SENT" | "SUCCEEDED" | "FAILED" | "EXPIRED"
export type FingerprintJobStep = "PLACE_FINGER" | "REMOVE_FINGER" | "PLACE_AGAIN"
export type FingerprintJobError =
  | "MISMATCH" // the two scans didn't match
  | "TIMEOUT" // nobody placed a finger in time
  | "BAD_IMAGE" // the sensor couldn't read the finger
  | "STORE_FAILED" // the sensor couldn't save the template
  | "DELETE_FAILED" // the sensor couldn't wipe the slot
  | "DEVICE_TIMEOUT" // the ESP32 took the job but never reported back (set by the backend)

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
  "X-Fingerprint": string // canonical JSON string of the browser fingerprint
}

/** Required on every authenticated REST call (not on /door/stream). */
export type AuthedHeaders = FingerprintHeader & {
  "X-CSRF-Token": string // value of the csrfToken cookie
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
  status: "UNLOCK_REQUESTED"
}

// ---------- GET /door/stream (SSE) ----------

export type DoorStreamQuery = {
  fingerprint: string // same string as X-Fingerprint, URL-encoded
}

/** Named SSE event `access`. `data` is JSON of AccessEventDTO. */
export type AccessStreamEvent = {
  event: "access"
  data: AccessEventDTO
}

/** Named SSE event `fingerprint`, sent on every fingerprint job change. */
export type FingerprintJobEventDTO = {
  job: FingerprintJobDTO
  fingerprint: FingerprintDTO | null // the new person, only on a SUCCEEDED ENROLL
}

export type FingerprintStreamEvent = {
  event: "fingerprint"
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
  "X-API-Key": string
}

export type ReportAccessRequest =
  | { deviceId: DeviceId; outcome: "GRANTED"; fingerprintSlot: number } // integer >= 0
  | { deviceId: DeviceId; outcome: "DENIED" | "ADMIN_UNLOCK"; fingerprintSlot?: null }

export type ReportAccessResponse = AccessEventDTO

export type PollCommandQuery = {
  deviceId: DeviceId
}

export type PollDeviceCommandResponse =
  | { command: null }
  | { command: "UNLOCK" }
  | { command: "ENROLL" | "DELETE"; jobId: string; slot: number }

export type ReportJobProgressRequest =
  | { deviceId: DeviceId; step: FingerprintJobStep | "SUCCEEDED" }
  | { deviceId: DeviceId; step: "FAILED"; error: Exclude<FingerprintJobError, "DEVICE_TIMEOUT"> }

export type ReportJobProgressResponse = FingerprintJobDTO

// ---------- Errors ----------

export type ApiErrorCode =
  // auth / session
  | "INVALID_CREDENTIALS"
  | "INVALID_USERNAME"
  | "INVALID_PASSWORD"
  | "INVALID_DEVICE_ID"
  | "SESSION_UNAUTHORIZED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  // input
  | "INVALID_BODY"
  | "VALIDATION_ERROR"
  // door / device
  | "UNKNOWN_DEVICE_ID"
  | "DEVICE_UNAUTHORIZED"
  | "DOOR_UNLOCK_SERVER_ERROR"
  | "POLL_DEVICE_ERROR"
  | "ACCESS_EVENT_SERVER_ERROR"
  // fingerprints
  | "FINGERPRINT_NOT_FOUND"
  | "FINGERPRINT_NAME_TAKEN"
  | "FINGERPRINT_SLOTS_FULL"
  | "FINGERPRINT_JOB_IN_PROGRESS"
  | "FINGERPRINT_JOB_NOT_FOUND"
  | "FINGERPRINT_JOB_NOT_ACTIVE"
  | "FINGERPRINT_SERVER_ERROR"
  // dashboard
  | "DASHBOARD_SUMMARY_ERROR"
  // generic
  | "SERVER_ERROR"
  | "NOT_FOUND"

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
  "SESSION_UNAUTHORIZED",
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
]
```

---

### 2. Dashboard endpoints

Every endpoint can also return `500 SERVER_ERROR` for an unexpected failure, and an unknown path returns `404 NOT_FOUND`. These aren't repeated in each table.

**Errors shared by every `AuthedHeaders` endpoint** (`/session/me`, `/session/logout`, `/dashboard/summary`, `/door/unlock`, `/fingerprints*`):

| Status | `error.code` | When | Frontend action |
| --- | --- | --- | --- |
| 400 | `INVALID_DEVICE_ID` | `X-Fingerprint` missing or not a valid fingerprint | Regenerate the fingerprint, then send to Login |
| 401 | `SESSION_UNAUTHORIZED` | No `sid` cookie, missing or mismatched CSRF token, fingerprint doesn't match the session, or the user was deleted | Clear state, go to Login |
| 401 | `TOKEN_EXPIRED` | Session JWT past `exp` | Clear state, go to Login |
| 401 | `TOKEN_INVALID` | JWT malformed, bad signature or wrong issuer | Clear state, go to Login |

#### 2.1 `POST /auth/login`

**Notes**
- **Does:** checks the username and password, then starts a 30-day session bound to this browser's fingerprint.
- **Used in:** the Login page ([[Wireframe & Flows#1. Login]], tracker F1).
- **Request / Response:** the fingerprint goes in a header, not the body. The response body has no token: the session arrives as the HTTP-only `sid` cookie plus a readable `csrfToken` cookie. In production the session cookie is named `__Secure-sid`.

| Part | Value |
| --- | --- |
| Auth | none |
| Headers | `FingerprintHeader`, `Content-Type: application/json` |
| Body | `LoginRequest` |
| Success | `200 LoginResponse` + `Set-Cookie: sid`, `csrfToken` |

```ts
const res = await fetch(`${API}/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", "X-Fingerprint": fingerprint } satisfies FingerprintHeader & Record<string, string>,
  body: JSON.stringify({ username, password } satisfies LoginRequest),
})
const body: LoginResponse | ApiError = await res.json()
```

```json
{ "user": { "username": "admin" }, "message": "Logged in successfully" }
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `INVALID_USERNAME` | `username` missing, empty or blank |
| 400 | `INVALID_PASSWORD` | `password` missing, empty or blank |
| 400 | `INVALID_DEVICE_ID` | `X-Fingerprint` missing, not JSON, not an object, or `{}` |
| 400 | `INVALID_BODY` | Body is empty or not valid JSON |
| 401 | `INVALID_CREDENTIALS` | Wrong username or password. The same response covers both, so it never reveals which one was wrong |

Only the first failing field is reported, in the order username, password, fingerprint.

#### 2.2 `GET /session/me`

**Notes**
- **Does:** checks that the current session is still valid and returns who is logged in.
- **Used in:** the app-load route guard ([[Wireframe & Flows#10. Session Expiry / Auto-Rotation]], tracker F2). Call it once on startup before showing the dashboard.
- **Request / Response:** there is no body to send. When under 1 hour of the session remains, the response also carries fresh `sid` and `csrfToken` cookies. Re-read `csrfToken` after this call and don't cache it.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders` |
| Success | `200 SessionResponse` (may include rotated `Set-Cookie`) |

```ts
const res = await fetch(`${API}/session/me`, { credentials: "include", headers: authedHeaders() })
const body: SessionResponse | ApiError = await res.json()
```

```json
{ "user": { "username": "admin" } }
```

Errors: the shared auth table above.

#### 2.3 `DELETE /session/logout`

**Notes**
- **Does:** clears both the `sid` and `csrfToken` cookies. Nothing is revoked server-side.
- **Used in:** the Logout button in the top bar ([[Wireframe & Flows#9. Logout]], tracker F2).
- **Request / Response:** there is no body to send. The call goes through the normal auth check, so an already-expired session gets `401 TOKEN_EXPIRED` instead of `200`. Clear local state and go to Login either way.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders` |
| Success | `200 LogoutResponse` + cookies cleared |

```ts
await fetch(`${API}/session/logout`, { method: "DELETE", credentials: "include", headers: authedHeaders() })
// regardless of the result: clear local auth state, router.push("/login")
```

```json
{ "message": "Logged out successfully." }
```

Errors: the shared auth table above.

#### 2.4 `GET /dashboard/summary`

**Notes**
- **Does:** returns today's granted and denied counts (UTC day), the time of the last event, and the 30 newest access events.
- **Used in:**
  - on mount of the Dashboard page ([[Wireframe & Flows#2. View Dashboard]], tracker F3);
  - again on every SSE reconnect, to catch up on missed events (§2.6).
- **Request / Response:** there is no body to send. `accessGrantedToday` includes `ADMIN_UNLOCK`. `lastEventAt` is `null` when there are no events yet; show `—`. `recentHistory` is newest first, with at most 30 entries and no pagination.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders` |
| Success | `200 DashboardSummaryResponse` |

```ts
const res = await fetch(`${API}/dashboard/summary`, { credentials: "include", headers: authedHeaders() })
const body: DashboardSummaryResponse | ApiError = await res.json()
```

```json
{
  "accessGrantedToday": 3,
  "accessDeniedToday": 1,
  "lastEventAt": "2026-08-05T02:30:00.000Z",
  "recentHistory": [
    {
      "id": "6f1c…",
      "deviceId": "front_gate",
      "deviceLabel": "Front Gate",
      "outcome": "GRANTED",
      "fingerprintSlot": 1,
      "fingerprintName": "Juan",
      "timestamp": "2026-08-05T02:30:00.000Z"
    }
  ]
}
```

| Status | `error.code` | When |
| --- | --- | --- |
| 500 | `DASHBOARD_SUMMARY_ERROR` | The summary query failed; show the error state and offer a retry |

Plus the shared auth table above.

#### 2.5 `POST /door/unlock`

**Notes**
- **Does:** marks a pending unlock for the device. The door does **not** open yet: the ESP32 picks it up on its next poll, about every 3 s, and a request older than 60 s is discarded.
- **Used in:** the "Unlock Door" button ([[Wireframe & Flows#5. Admin Manual Unlock]], tracker F4).
- **Request / Response:** send `{ "deviceId": "front_gate" }`. A `202` only means "queued", so show "Unlock requested". The real result arrives a few seconds later on `/door/stream` as an `ADMIN_UNLOCK` event. If no event arrives, the device was offline; let the admin click again.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders`, `Content-Type: application/json` |
| Body | `ManualDoorUnlockRequest` |
| Success | `202 ManualDoorUnlockResponse` |

```ts
const res = await fetch(`${API}/door/unlock`, {
  method: "POST",
  credentials: "include",
  headers: { ...authedHeaders(), "Content-Type": "application/json" },
  body: JSON.stringify({ deviceId: "front_gate" } satisfies ManualDoorUnlockRequest),
})
const body: ManualDoorUnlockResponse | ApiError = await res.json()
```

```json
{ "status": "UNLOCK_REQUESTED" }
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `UNKNOWN_DEVICE_ID` | `deviceId` missing, not a string, or not a configured device |
| 400 | `INVALID_BODY` | Body empty or not valid JSON |
| 400 | `VALIDATION_ERROR` | JSON body is not an object (`null`, an array, a string or a number) |
| 500 | `DOOR_UNLOCK_SERVER_ERROR` | The pending unlock couldn't be saved; nothing was queued |

Plus the shared auth table above. Auth is checked first, so a bad body without a session returns `401`.

#### 2.6 `GET /door/stream` (Server-Sent Events)

**Notes**
- **Does:** keeps a connection open and pushes every new access event (granted, denied or admin unlock) the moment the ESP32 reports it, plus every fingerprint job change (`fingerprint` event).
- **Used in:**
  - the live feed on the Dashboard, which drives toasts, sound, stat-card bumps, history prepends and the "Live / Disconnected" badge ([[Wireframe & Flows#3. Live Notification (Toast)]], tracker F5);
  - the live enrollment steps in Settings → Fingerprints ([[Wireframe & Flows#8. Manage Fingerprints]]).
- **Request / Response:**
  - `EventSource` can't send headers, so there is no CSRF and no `X-Fingerprint`. The session cookie plus a `fingerprint` **query param** authenticate the stream instead.
  - Only events that happen after the connection opens are sent; there is no replay.
  - The server also sends `: connected` and `: ping` (every 25 s) comment lines, which `EventSource` hides from JS.
  - Auth is only checked when connecting.

| Part | Value |
| --- | --- |
| Auth | session cookie + fingerprint query param (no CSRF) |
| Query | `DoorStreamQuery` |
| Success | `200 text/event-stream`, one `access` event per new access attempt |

```ts
function openDoorStream(onEvent: (e: AccessEventDTO) => void, onStatus: (live: boolean) => void) {
  const url = `${API}/door/stream?fingerprint=${encodeURIComponent(fingerprint)}`
  const es = new EventSource(url, { withCredentials: true }) // required to send the sid cookie cross-origin

  let hasOpened = false
  es.onopen = () => {
    onStatus(true)
    if (hasOpened) refetchSummary() // reconnect: catch up via REST, no replay toasts
    hasOpened = true
  }
  es.onerror = () => onStatus(false) // EventSource retries automatically

  es.addEventListener("access", (msg) => {
    const event = JSON.parse((msg as MessageEvent<string>).data) as AccessStreamEvent["data"]
    onEvent(event) // toast + sound, prepend to history, bump counts
  })

  es.addEventListener("fingerprint", (msg) => {
    const { job, fingerprint } = JSON.parse((msg as MessageEvent<string>).data) as FingerprintJobEventDTO
    // update the active job in Settings; on SUCCEEDED add `fingerprint` (ENROLL) or remove job.fingerprintId (DELETE)
  })

  return () => es.close() // call on logout / unmount
}
```

Raw wire format of each event:

```
event: access
data: {"id":"6f1c…","deviceId":"front_gate","deviceLabel":"Front Gate","outcome":"DENIED","fingerprintSlot":null,"fingerprintName":null,"timestamp":"2026-08-05T02:31:07.000Z"}

event: fingerprint
data: {"job":{"id":"9a2e…","deviceId":"front_gate","type":"ENROLL","status":"SENT","step":"PLACE_AGAIN","error":null,"name":"Juan","slot":1,"fingerprintId":null,"createdAt":"…","updatedAt":"…"},"fingerprint":null}

```

Missed `fingerprint` events are not replayed either. On reconnect, Settings refetches `GET /fingerprints` (§2.8).

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `INVALID_DEVICE_ID` | `fingerprint` query param missing or not a valid fingerprint |
| 401 | `SESSION_UNAUTHORIZED` | No `sid` cookie, or `fingerprint` doesn't match the session |
| 401 | `TOKEN_EXPIRED` / `TOKEN_INVALID` | Session JWT expired or invalid |

`EventSource` doesn't expose the status code or body of a failed connect; it only fires `onerror`. If the stream keeps failing, call `GET /session/me` to find out whether the session ended.

#### 2.7 `GET /healthz`

**Notes**
- **Does:** reports whether the API process is up. It touches no auth and no database.
- **Used in:** optional connectivity checks, such as a "server unreachable" banner. Not required by any flow.
- **Request / Response:** there is nothing to send, and the response is always `200 HealthResponse`. `GET /` redirects here.

```json
{ "status": "Server status is good." }
```

#### 2.8 `GET /fingerprints?deviceId=front_gate`

**Notes**
- **Does:** lists the enrolled people and the device's active fingerprint job, after expiring any stale job.
- **Used in:** on mount of Settings → Fingerprints, and again on every SSE reconnect ([[Wireframe & Flows#8. Manage Fingerprints]]).
- **Request / Response:** `fingerprints` is oldest first. `activeJob` is non-null while an enroll or delete is waiting for or running on the ESP32, so a page reload mid-enrollment shows the progress again.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders` |
| Query | `ListFingerprintsQuery` |
| Success | `200 ListFingerprintsResponse` |

```json
{
  "fingerprints": [
    { "id": "3b7d…", "deviceId": "front_gate", "name": "Juan", "slot": 1, "createdAt": "2026-08-05T02:30:00.000Z" }
  ],
  "activeJob": null
}
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `UNKNOWN_DEVICE_ID` | `deviceId` missing or not configured |
| 500 | `FINGERPRINT_SERVER_ERROR` | The list couldn't be read |

Plus the shared auth table above.

#### 2.9 `POST /fingerprints`

**Notes**
- **Does:** creates an `ENROLL` job with the lowest free sensor slot. Nothing is enrolled yet: the ESP32 picks the job up on its next poll (about 3 s), and a job not picked up within 60 s becomes `EXPIRED`.
- **Used in:** the "Add fingerprint" form in Settings.
- **Request / Response:** `202` only means "queued". Show "Waiting for the door…", then follow `fingerprint` SSE events for this `job.id`: `SENT` → steps `PLACE_FINGER` / `REMOVE_FINGER` / `PLACE_AGAIN` → `SUCCEEDED` (the event carries the new `FingerprintDTO`) or `FAILED` (`error` says why) or `EXPIRED`.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders`, `Content-Type: application/json` |
| Body | `EnrollFingerprintRequest` |
| Success | `202 EnrollFingerprintResponse` |

```json
// request
{ "deviceId": "front_gate", "name": "Juan" }
// 202 response
{ "id": "9a2e…", "deviceId": "front_gate", "type": "ENROLL", "status": "PENDING", "step": null, "error": null, "name": "Juan", "slot": 1, "fingerprintId": null, "createdAt": "…", "updatedAt": "…" }
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `name` missing, blank, or over 40 characters after trimming |
| 400 | `UNKNOWN_DEVICE_ID` | `deviceId` missing or not configured |
| 400 | `INVALID_BODY` | Body empty or not valid JSON |
| 409 | `FINGERPRINT_JOB_IN_PROGRESS` | Another enroll or delete is still pending or running |
| 409 | `FINGERPRINT_NAME_TAKEN` | Someone on this device already has that name |
| 409 | `FINGERPRINT_SLOTS_FULL` | All 127 sensor slots are used |
| 500 | `FINGERPRINT_SERVER_ERROR` | The job couldn't be created |

Plus the shared auth table above.

#### 2.10 `PATCH /fingerprints/:id`

**Notes**
- **Does:** renames a person. Database only; the ESP32 is not involved.
- **Used in:** inline rename in the fingerprint list.
- **Request / Response:** past history rows keep the old name (it was stored at scan time); new scans use the new one.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders`, `Content-Type: application/json` |
| Body | `RenameFingerprintRequest` |
| Success | `200 RenameFingerprintResponse` |

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `name` missing, blank, or over 40 characters |
| 400 | `INVALID_BODY` | Body empty or not valid JSON |
| 404 | `FINGERPRINT_NOT_FOUND` | No person with that id |
| 409 | `FINGERPRINT_NAME_TAKEN` | Another person already has that name |
| 500 | `FINGERPRINT_SERVER_ERROR` | The rename couldn't be saved |

Plus the shared auth table above.

#### 2.11 `DELETE /fingerprints/:id`

**Notes**
- **Does:** creates a `DELETE` job for that person's slot. The person stays listed until the ESP32 confirms the wipe.
- **Used in:** the delete button (with a confirm) in the fingerprint list.
- **Request / Response:** follow `fingerprint` SSE events for this `job.id`. On `SUCCEEDED`, remove `job.fingerprintId` from the list. On `FAILED` / `EXPIRED`, the person is still enrolled; let the admin retry.

| Part | Value |
| --- | --- |
| Auth | session cookie + CSRF + fingerprint |
| Headers | `AuthedHeaders` |
| Success | `202 DeleteFingerprintResponse` |

| Status | `error.code` | When |
| --- | --- | --- |
| 404 | `FINGERPRINT_NOT_FOUND` | No person with that id |
| 409 | `FINGERPRINT_JOB_IN_PROGRESS` | Another enroll or delete is still pending or running |
| 500 | `FINGERPRINT_SERVER_ERROR` | The job couldn't be created |

Plus the shared auth table above.

---

### 3. ESP32-only endpoints (the dashboard never calls these)

Documented so the firmware and the dashboard agree on `AccessEventDTO`. Both use the `X-API-Key` header (`DeviceApiKeyHeader`) with the value of `DEVICE_API_KEY`, over HTTPS in production.

#### 3.1 `POST /door/access`

**Notes**
- **Does:**
  - stores one access attempt with a server-generated timestamp;
  - adds the device label;
  - broadcasts the event to every open `/door/stream`.
- **Used in:** the ESP32 firmware, after every fingerprint scan (`GRANTED` or `DENIED`) and after running a polled unlock (`ADMIN_UNLOCK`). See [[System Design Documentation#2. Data Flow]].
- **Request / Response:** send `fingerprintSlot` only with `GRANTED`; omit it or send `null` otherwise. Don't send `id` or `timestamp`, because the server ignores them. The `201` body is the same `AccessEventDTO` the dashboard receives.

| Part | Value |
| --- | --- |
| Auth | `X-API-Key` |
| Headers | `DeviceApiKeyHeader`, `Content-Type: application/json` |
| Body | `ReportAccessRequest` |
| Success | `201 ReportAccessResponse` (`AccessEventDTO`) |

```json
// request
{ "deviceId": "front_gate", "outcome": "GRANTED", "fingerprintSlot": 1 }
// 201 response
{ "id": "6f1c…", "deviceId": "front_gate", "deviceLabel": "Front Gate", "outcome": "GRANTED", "fingerprintSlot": 1, "fingerprintName": "Juan", "timestamp": "2026-08-05T02:30:00.000Z" }
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bad `outcome`; `GRANTED` without a slot; a slot on `DENIED` or `ADMIN_UNLOCK`; a slot that isn't an integer ≥ 0; or a body that isn't an object. Details are in `issues` |
| 400 | `UNKNOWN_DEVICE_ID` | `deviceId` missing, not a string, or not configured |
| 400 | `INVALID_BODY` | Body not valid JSON |
| 401 | `DEVICE_UNAUTHORIZED` | `X-API-Key` missing or wrong |
| 500 | `ACCESS_EVENT_SERVER_ERROR` | The event couldn't be saved; nothing was broadcast |

#### 3.2 `GET /door/commands?deviceId=front_gate`

**Notes**
- **Does:** hands the ESP32 at most one pending command and claims it in the same step, so two polls can never both get it.
  - A pending unlock always comes first. One older than 60 s is cleared and returned as `null`.
  - Otherwise, the oldest pending fingerprint job is marked `SENT` and returned. One older than 60 s becomes `EXPIRED` instead.
- **Used in:** the ESP32 firmware poll loop, about every 3 s. This is the receiving end of `POST /door/unlock` (§2.5), `POST /fingerprints` (§2.9) and `DELETE /fingerprints/:id` (§2.11).
- **Request / Response:**
  - `"UNLOCK"`: run the open sequence now, then report `ADMIN_UNLOCK` via §3.1.
  - `"ENROLL"`: run the two-scan enrollment into `slot`, reporting each step and the result via §3.3.
  - `"DELETE"`: wipe `slot` on the sensor and report the result via §3.3.
  - `null`: do nothing.

| Part | Value |
| --- | --- |
| Auth | `X-API-Key` |
| Query | `PollCommandQuery` |
| Success | `200 PollDeviceCommandResponse` |

```json
{ "command": "UNLOCK" }
{ "command": "ENROLL", "jobId": "9a2e…", "slot": 1 }
{ "command": "DELETE", "jobId": "c41f…", "slot": 1 }
{ "command": null }
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `UNKNOWN_DEVICE_ID` | `deviceId` missing or not configured |
| 401 | `DEVICE_UNAUTHORIZED` | `X-API-Key` missing or wrong |
| 500 | `POLL_DEVICE_ERROR` | The pending command couldn't be read or cleared |

#### 3.3 `POST /door/jobs/:jobId/progress`

**Notes**
- **Does:** records a step or the final result of a fingerprint job and broadcasts it as a `fingerprint` SSE event. On `SUCCEEDED` it adds the person (ENROLL) or removes them (DELETE).
- **Used in:** the ESP32 firmware, during an `ENROLL` or `DELETE` command from §3.2.
- **Request / Response:**
  - Steps (ENROLL only), in order: `PLACE_FINGER` → `REMOVE_FINGER` → `PLACE_AGAIN`.
  - Then exactly one of `SUCCEEDED`, or `FAILED` with `error`.
  - A `409` means the backend already gave up on the job (for example `DEVICE_TIMEOUT`); stop and return to idle.

| Part | Value |
| --- | --- |
| Auth | `X-API-Key` |
| Headers | `DeviceApiKeyHeader`, `Content-Type: application/json` |
| Body | `ReportJobProgressRequest` |
| Success | `200 ReportJobProgressResponse` |

```json
{ "deviceId": "front_gate", "step": "PLACE_FINGER" }
{ "deviceId": "front_gate", "step": "SUCCEEDED" }
{ "deviceId": "front_gate", "step": "FAILED", "error": "MISMATCH" }
```

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Unknown `step` or `error`; `error` missing on `FAILED` or present otherwise |
| 400 | `UNKNOWN_DEVICE_ID` | `deviceId` missing or not configured |
| 400 | `INVALID_BODY` | Body not valid JSON |
| 401 | `DEVICE_UNAUTHORIZED` | `X-API-Key` missing or wrong |
| 404 | `FINGERPRINT_JOB_NOT_FOUND` | No job with that id for this device |
| 409 | `FINGERPRINT_JOB_NOT_ACTIVE` | The job isn't `SENT` any more |
| 500 | `FINGERPRINT_SERVER_ERROR` | The progress couldn't be saved |

---

**Related Docs: [[API & Database Reference]] & [[Wireframe & Flows]] & [[System Design Documentation]] & [[Implementation Tracker]]**
