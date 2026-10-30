## API & Database Reference

Source of truth for the database schema, shared types, endpoint list, request/response bodies, and route protection rules. Mirror shared types as TypeScript in the backend (per-feature `Backend-hono/src/features/*/types.ts`) and the frontend (`Frontend/src/types/api.ts`). Keep code in sync with this doc when the contract changes.

**Copy-paste TypeScript per endpoint (request, response, error codes, usage notes): [[API Contract]].**

**Naming:** Database columns, API JSON bodies, and shared TypeScript types all use **camelCase**.

### 1. Database Schema (MVP)

```
users
- id              (PK)
- username        (unique)
- hashedPassword
- createdAt
- updatedAt

accessEvents
- id              (PK)
- deviceId        (string)
- outcome         ("GRANTED" | "DENIED" | "ADMIN_UNLOCK")
- fingerprintSlot (number, nullable — set only when outcome is "GRANTED")
- fingerprintName (string, nullable — the enrolled person's name at scan time; null when not GRANTED or the slot is unknown)
- timestamp       (datetime, UTC, server-generated)

deviceCommands
- deviceId        (PK, string)
- pendingUnlockAt (datetime, nullable — set when the admin requests a manual unlock, cleared the moment the ESP32 polls it)

fingerprints
- id              (PK)
- deviceId        (string)
- slot            (number, 1–127 — the sensor's onboard template slot)
- name            (string, 1–40 chars, unique per device, case-insensitive)
- createdAt
- updatedAt
- unique (deviceId, slot)

fingerprintJobs
- id              (PK)
- deviceId        (string)
- type            ("ENROLL" | "DELETE")
- slot            (number — the slot being enrolled into or wiped)
- name            (string — the person's name, for display)
- fingerprintId   (string, nullable — the person being deleted; null for ENROLL)
- status          ("PENDING" | "SENT" | "SUCCEEDED" | "FAILED" | "EXPIRED")
- step            (string, nullable — last progress step the ESP32 reported)
- error           (string, nullable — failure reason when status is "FAILED")
- sentAt          (datetime, nullable — when the ESP32 picked the job up; the device timeout counts from here)
- createdAt
- updatedAt
- index (deviceId, status)
- unique partial index (deviceId) where status IN ("PENDING", "SENT") — at most one active job per device
```

- One admin `users` row is seeded at setup. No self-service registration. Enrolled people are not users — they have no login.
- No `devices` table — labels come from backend config (see [[System Design Documentation#4. Device Label Map]]).
- No `settings` table — sound preferences live client-side.
- No `acknowledged` fields — history is a log, not a task list.
- `fingerprints` maps a sensor slot to a person's name. The biometric template itself lives only on the sensor's onboard flash, never in PostgreSQL.
- A `fingerprints` row is written only after the ESP32 confirms the enrollment, and removed only after it confirms the delete — the table reflects what the sensor holds.
- `deviceCommands` stays a single row per device for `UNLOCK`; fingerprint work goes through `fingerprintJobs` instead (see §6.10).
- The `deviceCommands` row is created lazily: `POST /door/unlock` upserts it on the first unlock request for a configured `deviceId` (no startup seeding). `deviceId` is validated against the device label map before any write.
- Index `accessEvents.timestamp` — it backs both the "today" counts and the last-30 `recentHistory` query.

### 2. Shared Types

```ts
type AccessEvent = {
  id: string
  deviceId: string
  deviceLabel: string
  outcome: "GRANTED" | "DENIED" | "ADMIN_UNLOCK"
  fingerprintSlot: number | null // sensor's onboard template slot that matched; null when outcome is "DENIED" or "ADMIN_UNLOCK"
  fingerprintName: string | null // enrolled person's name at scan time; null when not GRANTED or the slot isn't enrolled
  timestamp: string // ISO 8601 UTC, e.g. "2026-08-05T02:30:00.000Z"
}

type Fingerprint = {
  id: string
  deviceId: string
  name: string
  slot: number
  createdAt: string // ISO 8601 UTC
}

type FingerprintJobStep = "PLACE_FINGER" | "REMOVE_FINGER" | "PLACE_AGAIN"
type FingerprintJobError =
  | "MISMATCH"       // the two scans didn't match
  | "TIMEOUT"        // no finger placed in time at the door
  | "BAD_IMAGE"      // the sensor couldn't read the finger
  | "STORE_FAILED"   // the sensor couldn't save the template
  | "DELETE_FAILED"  // the sensor couldn't wipe the slot
  | "DEVICE_TIMEOUT" // the ESP32 picked the job up but never reported a result

type FingerprintJob = {
  id: string
  deviceId: string
  type: "ENROLL" | "DELETE"
  status: "PENDING" | "SENT" | "SUCCEEDED" | "FAILED" | "EXPIRED"
  step: FingerprintJobStep | null
  error: FingerprintJobError | null // set only when status is "FAILED"
  name: string
  slot: number
  fingerprintId: string | null // DELETE only
  createdAt: string
  updatedAt: string
}

type FingerprintList = {
  fingerprints: Fingerprint[] // oldest first
  activeJob: FingerprintJob | null // the PENDING/SENT job, if any
}

// SSE `fingerprint` event payload
type FingerprintJobEvent = {
  job: FingerprintJob
  fingerprint: Fingerprint | null // the new person, only on a SUCCEEDED ENROLL
}

type DashboardSummary = {
  accessGrantedToday: number // includes "ADMIN_UNLOCK" events — the door was opened either way
  accessDeniedToday: number
  lastEventAt: string | null // ISO 8601 UTC; null if no access events yet
  recentHistory: AccessEvent[] // newest first, max 30
}

type PendingCommand =
  | { command: null } // nothing pending
  | { command: "UNLOCK" }
  | { command: "ENROLL" | "DELETE"; jobId: string; slot: number }

// JWT payload (issued in sid cookie) — single-user MVP
type TokenPayload = {
  sub: string       // user id
  deviceHash: string
  iss: string
  exp: number
  iat: number
  nonce: string     // random 8-char value so tokens issued in the same second differ
}

type SessionResponse = {
  user: { username: string }
}

type LoginResponse = SessionResponse & {
  message: string
}

// Every error response (auth, session, validation, server) uses this envelope
type ApiError = {
  error: {
    code: string // stable machine-readable code — the frontend switches on this
    message: string
    field?: string // which input/step failed, when known
    data?: Record<string, unknown>
    issues?: { path: string; message: string }[] // only for VALIDATION_ERROR
  }
}
```

### 3. API Endpoints

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public + fingerprint header | Validate credentials, issue session |
| GET | `/session/me` | Session + CSRF + fingerprint | Validate/rotate current session |
| DELETE | `/session/logout` | Session + CSRF + fingerprint | Clear session cookies |
| POST | `/door/access` | API key | ESP32 reports a fingerprint access attempt (granted or denied) |
| GET | `/dashboard/summary` | Session + CSRF + fingerprint | Initial load: stats + last 30 history entries |
| GET | `/door/stream` | Session cookie + fingerprint query | SSE stream of live access events |
| POST | `/door/unlock` | Session + CSRF + fingerprint | Admin requests a manual unlock, independent of fingerprint match |
| GET | `/door/commands` | API key | ESP32 polls for a pending command (manual unlock or fingerprint job) |
| POST | `/door/jobs/:jobId/progress` | API key | ESP32 reports a fingerprint job step or its final result |
| GET | `/fingerprints` | Session + CSRF + fingerprint | List enrolled people and the active fingerprint job |
| POST | `/fingerprints` | Session + CSRF + fingerprint | Start enrolling a new person |
| PATCH | `/fingerprints/:id` | Session + CSRF + fingerprint | Rename a person |
| DELETE | `/fingerprints/:id` | Session + CSRF + fingerprint | Start removing a person from the sensor |

### 4. Route Protection

| Endpoint | Session cookie | CSRF header | Fingerprint | API key |
| --- | --- | --- | --- | --- |
| `POST /auth/login` | — | — | header (required) | — |
| `GET /session/me` | required | required | header | — |
| `DELETE /session/logout` | required | required | header | — |
| `POST /door/access` | — | — | — | required |
| `GET /dashboard/summary` | required | required | header | — |
| `GET /door/stream` | required | — | query param | — |
| `POST /door/unlock` | required | required | header | — |
| `GET /door/commands` | — | — | — | required |
| `POST /door/jobs/:jobId/progress` | — | — | — | required |
| `GET /fingerprints` | required | required | header | — |
| `POST /fingerprints` | required | required | header | — |
| `PATCH /fingerprints/:id` | required | required | header | — |
| `DELETE /fingerprints/:id` | required | required | header | — |

REST endpoints use `authenticate` middleware. SSE uses a separate `authenticateSse` middleware (see [[System Design Documentation#6. Auth Middleware]]).

### 5. Endpoint Contracts

#### `POST /auth/login`

**Headers:** `X-Fingerprint` (required) — canonical JSON string of the browser fingerprint (see §6.3)

**Request**

```json
{ "username": "admin", "password": "..." }
```

**Response `200`**

```json
{
  "user": { "username": "admin" },
  "message": "Logged in successfully"
}
```

Same `user` shape as `GET /session/me`, plus `message`. The user `id` is not returned (it is only in the JWT `sub`).

Sets `sid` (HTTP-only, signed) and `csrfToken` cookies. JWT includes `deviceHash = hash(fingerprint)`.

**Response `401`**

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password. Please try again.",
    "field": "username_password"
  }
}
```

Same response whether the username does not exist or the password is wrong.

**Response `400`** — `error.code` is one of:

| Code | When |
| --- | --- |
| `INVALID_USERNAME` | `username` empty or blank |
| `INVALID_PASSWORD` | `password` empty or blank |
| `INVALID_DEVICE_ID` | `X-Fingerprint` missing or not a valid fingerprint (see §6.3) |
| `INVALID_BODY` | request body missing or not valid JSON |

#### `GET /session/me`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `200`**

```json
{ "user": { "username": "admin" } }
```

If less than 1 hour remains before JWT expiry, the same `200` response includes refreshed `Set-Cookie` headers with a new `sid` and `csrfToken` (extended expiry). See §6.4.

**Response `401`**

```json
{
  "error": {
    "code": "SESSION_UNAUTHORIZED",
    "message": "Your session is invalid or has expired. Please log in again.",
    "field": "authenticate_session_cookie"
  }
}
```

`error.code` is one of `SESSION_UNAUTHORIZED` (missing session cookie, missing or mismatched CSRF token, fingerprint does not match the token, or the user no longer exists), `TOKEN_EXPIRED`, or `TOKEN_INVALID`.

**Response `400`** — `INVALID_DEVICE_ID` when `X-Fingerprint` is missing or not a valid fingerprint.

#### `DELETE /session/logout`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `200`**

```json
{ "message": "Logged out successfully." }
```

Clears **both** `sid` and `csrfToken` cookies.

Logout goes through `authenticate`, so an already-expired session returns `401 TOKEN_EXPIRED` instead. The frontend should clear its local auth state either way.

#### `POST /door/access`

**Headers:** `X-API-Key: <shared-secret>`

**Transport:** HTTPS only in production.

**Request**

```json
{ "deviceId": "front_gate", "outcome": "GRANTED", "fingerprintSlot": 1 }
```

`outcome` is `"GRANTED"`, `"DENIED"`, or `"ADMIN_UNLOCK"` (the last one reported after the ESP32 executes a pending command from `GET /door/commands`). `fingerprintSlot` must be present when `outcome` is `"GRANTED"` and omitted/null for `"DENIED"` or `"ADMIN_UNLOCK"`.

On `GRANTED`, the backend looks up the `fingerprints` row for (`deviceId`, `fingerprintSlot`) and stores its current name as `fingerprintName` (null if the slot isn't enrolled in the database).

**Response `201`** — access event accepted

```json
{
  "id": "uuid",
  "deviceId": "front_gate",
  "deviceLabel": "Front Gate",
  "outcome": "GRANTED",
  "fingerprintSlot": 1,
  "fingerprintName": "Juan",
  "timestamp": "2026-08-05T02:30:00.000Z"
}
```

**Response `401`** — invalid or missing API key (compared with constant-time equality).

**Response `400`** — unknown `deviceId`, invalid `outcome` value, or `fingerprintSlot` present/missing inconsistent with `outcome` (`UNKNOWN_DEVICE_ID`, `VALIDATION_ERROR`); `INVALID_BODY` if the body is not valid JSON.

**Response `500`** — `ACCESS_EVENT_SERVER_ERROR`: the event could not be persisted (nothing is broadcast).

#### `GET /dashboard/summary`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `200`**

```json
{
  "accessGrantedToday": 3,
  "accessDeniedToday": 1,
  "lastEventAt": "2026-08-05T02:30:00.000Z",
  "recentHistory": [
    {
      "id": "uuid",
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

`accessGrantedToday` / `accessDeniedToday` count events whose UTC timestamp falls on the current UTC calendar day, split by `outcome`; `accessGrantedToday` includes `"ADMIN_UNLOCK"` events.

**Response `401`** — `SESSION_UNAUTHORIZED` / `TOKEN_EXPIRED` / `TOKEN_INVALID` (see §6.8); `400 INVALID_DEVICE_ID` if `X-Fingerprint` is missing or invalid.

**Response `500`** — `DASHBOARD_SUMMARY_ERROR`.

#### `POST /door/unlock`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Request**

```json
{ "deviceId": "front_gate" }
```

**Response `202`**

```json
{ "status": "UNLOCK_REQUESTED" }
```

Upserts the device's `deviceCommands` row with `pendingUnlockAt = now()`. Does not wait for the ESP32 to act — the resulting `ADMIN_UNLOCK` access event arrives later via SSE once the ESP32 polls and executes it.

**Response `401`**

```json
{ "error": { "code": "SESSION_UNAUTHORIZED", "message": "Your session is invalid or has expired. Please log in again." } }
```

**Response `400`** — `UNKNOWN_DEVICE_ID` if `deviceId` is missing, not a string, or not a configured device; `INVALID_BODY` if the body is empty or not valid JSON; `VALIDATION_ERROR` if the JSON body is not an object (e.g. `null`, an array). Authentication is checked first, so an unauthenticated request with a bad body is `401`, not `400`.

**Response `500`** — `DOOR_UNLOCK_SERVER_ERROR`: the pending-unlock row could not be written.

#### `GET /door/commands?deviceId=front_gate`

**Headers:** `X-API-Key: <shared-secret>`

**Response `200`**

```json
{ "command": "UNLOCK" }
```

or a fingerprint job:

```json
{ "command": "ENROLL", "jobId": "uuid", "slot": 3 }
```

```json
{ "command": "DELETE", "jobId": "uuid", "slot": 3 }
```

or, when nothing is pending:

```json
{ "command": null }
```

**Order on each poll:** a pending unlock always wins. Only when there is no unlock to deliver does the backend look for a fingerprint job. At most one command is returned per poll.

**Fingerprint job delivery:** the backend claims the oldest `PENDING` job for the device in a single atomic statement (`UPDATE "fingerprintJobs" SET "status" = 'SENT' WHERE "deviceId" = $1 AND "status" = 'PENDING' AND "createdAt" > <now − TTL> RETURNING …`), so a job is delivered at most once. A `PENDING` job older than `UNLOCK_COMMAND_TTL_SECONDS` is marked `EXPIRED` instead of delivered.

**Unlock delivery:** the backend consumes the command in a **single atomic statement** (e.g. `UPDATE "deviceCommands" SET "pendingUnlockAt" = NULL WHERE "deviceId" = $1 AND "pendingUnlockAt" IS NOT NULL RETURNING` the previous value — or the Prisma equivalent), never a separate read then write. Two overlapping polls therefore can never both receive `"UNLOCK"`.

- If the consumed `pendingUnlockAt` is within `UNLOCK_COMMAND_TTL_SECONDS` (default `60`) of now, the backend returns `"UNLOCK"`.
- If it is older than the TTL, it is still cleared but treated as expired: the response is `{ "command": null }`. This prevents a stale request from opening the door when an offline ESP32 reconnects much later.
- Consumption is fire-and-forget — no retry if the ESP32 fails to act on it.

**Response `401`** — invalid or missing API key.

**Response `400`** — `UNKNOWN_DEVICE_ID`: `deviceId` is missing or not a configured device.

**Response `500`** — `POLL_DEVICE_ERROR`: the pending command could not be consumed.

#### `POST /door/jobs/:jobId/progress`

**Headers:** `X-API-Key: <shared-secret>`

**Request** — an in-progress step:

```json
{ "deviceId": "front_gate", "step": "PLACE_AGAIN" }
```

or the final result:

```json
{ "deviceId": "front_gate", "step": "SUCCEEDED" }
```

```json
{ "deviceId": "front_gate", "step": "FAILED", "error": "MISMATCH" }
```

`step` is one of `PLACE_FINGER`, `REMOVE_FINGER`, `PLACE_AGAIN` (ENROLL only), `SUCCEEDED`, or `FAILED`. `error` is required when `step` is `FAILED` (one of `MISMATCH`, `TIMEOUT`, `BAD_IMAGE`, `STORE_FAILED`, `DELETE_FAILED`) and must be omitted otherwise. `DEVICE_TIMEOUT` is set only by the backend.

- In-progress steps update `step` and keep the job `SENT`.
- `SUCCEEDED` on an `ENROLL` job inserts the `fingerprints` row (slot, name) and marks the job `SUCCEEDED` in one transaction. On a `DELETE` job it removes the `fingerprints` row and marks the job `SUCCEEDED`.
- `FAILED` marks the job `FAILED` with `error`. Nothing else changes — a failed delete keeps the person listed.
- Every accepted report is broadcast over SSE as a `fingerprint` event.

**Response `200`** — the updated `FingerprintJob`.

**Response `401`** — invalid or missing API key.

**Response `400`** — `UNKNOWN_DEVICE_ID`; `VALIDATION_ERROR` for an unknown `step`/`error` or a wrong `error` presence; `INVALID_BODY`.

**Response `404`** — `FINGERPRINT_JOB_NOT_FOUND`: no job with that id for this device.

**Response `409`** — `FINGERPRINT_JOB_NOT_ACTIVE`: the job is not `SENT` (already finished, expired, or timed out). The ESP32 ignores this and returns to idle.

**Response `500`** — `FINGERPRINT_SERVER_ERROR`.

#### `GET /fingerprints?deviceId=front_gate`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `200`**

```json
{
  "fingerprints": [
    { "id": "uuid", "deviceId": "front_gate", "name": "Juan", "slot": 1, "createdAt": "2026-08-05T02:30:00.000Z" }
  ],
  "activeJob": null
}
```

`activeJob` is the device's `PENDING` or `SENT` job, if any, after applying expiry (see §6.10) — so a page reload mid-enrollment picks the progress back up.

**Response `400`** — `UNKNOWN_DEVICE_ID`. **`401`** — session errors. **`500`** — `FINGERPRINT_SERVER_ERROR`.

#### `POST /fingerprints`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Request**

```json
{ "deviceId": "front_gate", "name": "Juan" }
```

`name` is trimmed and must be 1–40 characters.

**Response `202`** — the new `FingerprintJob` (`type: "ENROLL"`, `status: "PENDING"`, `slot` = lowest free slot 1–127). Also broadcast over SSE. Progress and the result arrive later as SSE `fingerprint` events.

**Response `409`** — `FINGERPRINT_JOB_IN_PROGRESS` (another job is `PENDING`/`SENT`), `FINGERPRINT_NAME_TAKEN` (case-insensitive match on this device), or `FINGERPRINT_SLOTS_FULL` (all 127 slots used).

**Response `400`** — `UNKNOWN_DEVICE_ID`, `VALIDATION_ERROR`, `INVALID_BODY`. **`401`** — session errors. **`500`** — `FINGERPRINT_SERVER_ERROR`.

#### `PATCH /fingerprints/:id`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Request**

```json
{ "name": "Juan D." }
```

**Response `200`** — the updated `Fingerprint`. Database only; the ESP32 is not involved. Past access events keep the name they were recorded with.

**Response `404`** — `FINGERPRINT_NOT_FOUND`. **`409`** — `FINGERPRINT_NAME_TAKEN`. **`400`** — `VALIDATION_ERROR`, `INVALID_BODY`. **`401`** — session errors. **`500`** — `FINGERPRINT_SERVER_ERROR`.

#### `DELETE /fingerprints/:id`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `202`** — the new `FingerprintJob` (`type: "DELETE"`, `status: "PENDING"`, `fingerprintId` = `:id`). The person stays listed until the ESP32 confirms the wipe.

**Response `404`** — `FINGERPRINT_NOT_FOUND`. **`409`** — `FINGERPRINT_JOB_IN_PROGRESS`. **`401`** — session errors. **`500`** — `FINGERPRINT_SERVER_ERROR`.

#### `GET /door/stream?fingerprint=<fingerprint>`

**Auth:** session cookie (`sid`) sent automatically by the browser; `fingerprint` query param carries the device fingerprint (since `EventSource` cannot send `X-Fingerprint`). Validated by `authenticateSse` — same hash compare as REST, **no CSRF** on this read-only GET. Note: this `fingerprint` is the browser fingerprint used for session binding, unrelated to the physical fingerprint sensor on the door hardware.

**Response:** `text/event-stream`

Two named events share the one connection:

```
event: access
data: {"id":"uuid","deviceId":"front_gate","deviceLabel":"Front Gate","outcome":"GRANTED","fingerprintSlot":1,"fingerprintName":"Juan","timestamp":"2026-08-05T02:30:00.000Z"}

event: fingerprint
data: {"job":{"id":"uuid","type":"ENROLL","status":"SENT","step":"PLACE_AGAIN",...},"fingerprint":null}
```

`access` payloads match `AccessEvent`. `fingerprint` payloads match `FingerprintJobEvent` and are sent when a job is created, delivered to the ESP32, reports a step, finishes, or expires.

**Connection:** the server writes a `: connected` comment immediately on open so the client and any proxy see bytes right away. Auth is checked once, at connect; an already-open stream is not closed when the session expires or the user logs out (consistent with §6.4 — no server-side revocation).

**Heartbeat:** the server writes a comment line (`: ping\n\n`) every **25 seconds** (`SSE_HEARTBEAT_SECONDS`) so idle connections are not dropped by proxies or load balancers. Comments are ignored by `EventSource`, so the client sees no event. Responses use `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `X-Accel-Buffering: no`; disable response compression/buffering on this route at the reverse proxy.

**Reconnect:** no event IDs and no replay — a missed event is never re-sent. The browser's `EventSource` reconnects automatically; on reconnect the dashboard refetches `GET /dashboard/summary` to catch up (missed events appear in stats/history only, no toasts).

### 6. Security Requirements

#### 6.1 Session cookies

| Cookie | Attributes |
| --- | --- |
| `sid` | HTTP-only, signed, `SameSite=Lax`, `path=/`, 30-day `Max-Age`. In production: `Secure`, `__Secure-` name prefix, `Domain=<DOMAIN>` |
| `csrfToken` | readable by JS (for double-submit), `SameSite=Lax`, `path=/`, 30-day `Max-Age`. In production: `Secure`, `Domain=<DOMAIN>` (no name prefix) |

CSRF protection: `X-CSRF-Token` header must match the `csrfToken` cookie on all authenticated REST requests (`GET /session/me`, `DELETE /session/logout`, and the mutating dashboard/door routes).

#### 6.2 Login protection

- Use generic `"Invalid username or password"` — do not reveal whether the username exists.
- Seeded admin password must meet a minimum strength requirement at setup (document in deployment README).
- **No rate limiting or lockout on `POST /auth/login`.** Known MVP limitation: the API is deployed privately (not exposed publicly) with a single admin account, so brute-force exposure is limited to the private network. Revisit (e.g. Hono rate-limit middleware) before any public exposure.

#### 6.3 Device fingerprint

- Client generates fingerprint on first visit (e.g. ThumbmarkJs or equivalent) and stores the **canonical JSON string** in session storage.
- Sent as `X-Fingerprint` header on login and all authenticated REST calls.
- Server rejects fingerprints that are missing, not valid JSON, not a JSON object (arrays and primitives), or an empty object. Any object with at least one key is accepted.
- At login, server computes `deviceHash = hash(fingerprint)` (HMAC-SHA256 keyed with `HASH_SECRET`) and embeds it in the JWT. All subsequent requests must present the same fingerprint; mismatch → `401 SESSION_UNAUTHORIZED`. A missing or invalid fingerprint → `400 INVALID_DEVICE_ID` (login and every authenticated route).
- **Token theft mitigation:** a stolen `sid` cookie alone is not enough — the attacker must also present the matching fingerprint from the same browser. Combined with HTTPS, this is the primary session security control for this MVP. No server-side token revocation list (`jti`) is used.

#### 6.4 JWT rotation

- Default session lifetime: 30 days (`JWT_REFRESH_TOKEN_EXPIRES_IN`).
- Rotation trigger: less than 1 hour remains before `exp` on `GET /session/me`.
- On rotation: issue new `sid` + `csrfToken` with extended expiry. No server-side revocation of the previous token — it remains valid until its original `exp`, but is unusable without the bound fingerprint.
- Rotation is stateless: there is no lock, so concurrent requests near expiry may each receive a new valid token.
- Logout clears cookies client-side; no server-side token blacklist.

#### 6.5 Device API key (`POST /door/access`)

- API key stored in server env (`DEVICE_API_KEY`), never in client code.
- Compare keys with **constant-time** equality.
- **HTTPS required** in production — ESP32 must use TLS.
- **Known MVP limitation:** a single shared key can assert any configured `deviceId` and `outcome`. Acceptable for this single-device school project; HTTPS and physical custody of the device are the controls — there is no debounce or rate limit on this endpoint.
- `GET /door/commands` and `POST /door/jobs/:jobId/progress` reuse this same API key control — no separate auth mechanism for command polling or progress reports.

**Backend environment variables introduced by the door features** (see `Backend-hono/.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEVICE_API_KEY` | — (required) | Shared secret the ESP32 sends as `X-API-Key` |
| `UNLOCK_COMMAND_TTL_SECONDS` | `60` | How long a pending manual unlock or fingerprint job stays valid before the ESP32 picks it up (see §6.6, §6.10) |
| `FINGERPRINT_JOB_TIMEOUT_SECONDS` | `120` | How long a delivered fingerprint job may run before it is marked `FAILED` / `DEVICE_TIMEOUT` (see §6.10) |
| `SSE_HEARTBEAT_SECONDS` | `25` | Interval of the `: ping` comment on `GET /door/stream` |

#### 6.6 Admin unlock delivery

- `POST /door/unlock` bypasses fingerprint matching entirely, so it is gated by the full dashboard session stack (signed `sid` cookie, CSRF, fingerprint binding) — the same protection as every other dashboard mutation. No additional re-confirmation step (e.g. password re-entry) is required.
- Command delivery is **fire-and-forget**: `pendingUnlockAt` is cleared atomically the moment `GET /door/commands` is polled, regardless of whether the ESP32 successfully completes the physical unlock afterward. There is no retry, no delivery confirmation back to the admin, and no queueing of multiple pending unlocks — a second click while one is already pending just resets the same timestamp.
- **Commands expire.** A pending unlock older than `UNLOCK_COMMAND_TTL_SECONDS` (default 60) is discarded when polled instead of executed, so an ESP32 that was offline cannot open the door on reconnect long after the admin's click. The admin sees nothing and simply clicks "Unlock Door" again.
- Known MVP limitation: if the ESP32 is offline, or loses power right after consuming the command, the unlock is silently lost with no error surfaced to the dashboard. Acceptable for this single-device school project.

#### 6.7 SSE fingerprint in query string

Fingerprint in the SSE URL increases exposure via server logs and browser history. Required mitigations:

- **Do not log query strings** for `/door/stream` on the reverse proxy / API server (primary control for fingerprint leakage).
- **Frontend `Referrer-Policy: no-referrer`** — set on the Vue dashboard only, **not** on Hono API responses. Tells the browser not to send a `Referer` header when the user navigates away from the dashboard to an external site. Set via `<meta name="referrer" content="no-referrer">` in `index.html`, or as an HTTP response header on the static host serving the SPA (Vite dev server, nginx, Netlify, etc.).
- `SameSite=Lax` on `sid` prevents cross-site sites from opening a credentialed `EventSource` to the API.
- CSRF is intentionally omitted on this read-only GET; cookie + fingerprint binding is the control.

#### 6.8 Error codes

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | Wrong username/password on login |
| `INVALID_USERNAME` | 400 | Empty or blank `username` on login |
| `INVALID_PASSWORD` | 400 | Empty or blank `password` on login |
| `INVALID_DEVICE_ID` | 400 | Missing or invalid fingerprint (login and authenticated routes) |
| `INVALID_BODY` | 400 | Request body missing or not valid JSON |
| `VALIDATION_ERROR` | 400 | Input failed schema validation (including a JSON body that is not an object); field details in `error.issues` |
| `SESSION_UNAUTHORIZED` | 401 | Missing session cookie, missing/mismatched CSRF token, fingerprint mismatch, or user no longer exists |
| `UNKNOWN_DEVICE_ID` | 400 | `deviceId` is missing or not a configured device (`/door/*`, `/fingerprints`) |
| `DEVICE_UNAUTHORIZED` | 401 | Missing or invalid `X-API-Key` on a device endpoint (`/door/access`, `/door/commands`, `/door/jobs/:jobId/progress`) |
| `FINGERPRINT_NOT_FOUND` | 404 | No enrolled person with that id (`PATCH`/`DELETE /fingerprints/:id`) |
| `FINGERPRINT_NAME_TAKEN` | 409 | Another person on this device already has that name (case-insensitive) |
| `FINGERPRINT_SLOTS_FULL` | 409 | All 127 sensor slots are in use |
| `FINGERPRINT_JOB_IN_PROGRESS` | 409 | A fingerprint job is already `PENDING`/`SENT` for this device |
| `FINGERPRINT_JOB_NOT_FOUND` | 404 | Progress reported for a job id that doesn't exist on this device |
| `FINGERPRINT_JOB_NOT_ACTIVE` | 409 | Progress reported for a job that is no longer `SENT` |
| `FINGERPRINT_SERVER_ERROR` | 500 | Reading or writing fingerprints/jobs failed |
| `TOKEN_EXPIRED` | 401 | Session JWT is past its `exp` |
| `TOKEN_INVALID` | 401 | Session JWT is malformed, has a bad signature, or the wrong issuer |
| `DOOR_UNLOCK_SERVER_ERROR` | 500 | Writing the pending unlock from `POST /door/unlock` failed |
| `POLL_DEVICE_ERROR` | 500 | Consuming the pending command in `GET /door/commands` failed |
| `ACCESS_EVENT_SERVER_ERROR` | 500 | Persisting an access event from `POST /door/access` failed |
| `DASHBOARD_SUMMARY_ERROR` | 500 | Building `GET /dashboard/summary` failed |
| `SERVER_ERROR` | 500 | Unexpected server failure (no internal details exposed) |
| `NOT_FOUND` | 404 | No such route |

#### 6.9 Error response envelope

All errors use the `ApiError` shape from §2: `{ "error": { "code", "message", "field?", "data?", "issues?" } }`. The frontend switches on `error.code`. Only `VALIDATION_ERROR` includes `issues`, as `[{ "path": "username", "message": "..." }]`. Unmatched routes return `404 NOT_FOUND` in the same envelope.

#### 6.10 Fingerprint management (dashboard-driven)

- Enrollment and deletion are started from the dashboard and executed by the ESP32 through the existing poll channel. The sensor scans the same finger twice, merges the scans into one template, and stores it in the assigned slot (`storeModel(slot)`); deletion wipes the slot (`deleteModel(slot)`). The OLED shows the prompts; the buzzer/LEDs confirm the result.
- Templates never leave the sensor. PostgreSQL holds only slot ↔ name.
- **Trust level:** any authenticated dashboard session can enroll or remove a person — the same protection as `POST /door/unlock`, which can already open the door. Enrolling still requires the person to be physically at the sensor to scan.
- **One active job per device.** A second enroll/delete request while one is `PENDING`/`SENT` returns `409 FINGERPRINT_JOB_IN_PROGRESS`.
- **Slot choice:** the backend assigns the lowest slot 1–127 not used by a `fingerprints` row on that device. The admin never chooses a slot.
- **Expiry, computed on read** (in `GET /fingerprints`, `GET /door/commands`, and before creating a job) — no background timer:
  - `PENDING` older than `UNLOCK_COMMAND_TTL_SECONDS` → `EXPIRED` (the ESP32 was offline). Prevents a stale request from starting an enrollment hours later.
  - `SENT` with no final report within `FINGERPRINT_JOB_TIMEOUT_SECONDS` → `FAILED` / `DEVICE_TIMEOUT` (the ESP32 lost power or WiFi mid-flow). The ESP32's own per-step timeout (20s) is well inside this.
  - Each transition is broadcast as an SSE `fingerprint` event.
- No access event is ever generated by enrollment or deletion — they are not access attempts.
- **One-time migration:** fingers enrolled over USB before this feature are unknown to the database. Wipe the sensor once with the `wipe-fingerprints` firmware env, then re-enroll from the dashboard (see [[Hardware Setup Guide]]).

See [[System Documentation#5. Fingerprint Management]].

**Related Docs: [[System Documentation]] & [[System Design Documentation]] & [[Wireframe & Flows]] & [[API Contract]]**
