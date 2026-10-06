## API & Database Reference

Source of truth for the database schema, shared types, endpoint list, request/response bodies, and route protection rules. Mirror shared types as TypeScript in the backend and frontend (e.g. `Backend-hono/src/types/api.ts`, `Frontend/src/types/api.ts`). Keep code in sync with this doc when the contract changes.

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
- timestamp       (datetime, UTC, server-generated)

deviceCommands
- deviceId        (PK, string)
- pendingUnlockAt (datetime, nullable — set when the admin requests a manual unlock, cleared the moment the ESP32 polls it)
```

- One admin `users` row is seeded at setup. No self-service registration.
- No `devices` table — labels come from backend config (see [[System Design Documentation#4. Device Label Map]]).
- No `settings` table — sound preferences live client-side.
- No `acknowledged` fields — history is a log, not a task list.
- No `fingerprints` table — biometric templates live on the sensor's own onboard flash, not in PostgreSQL. `fingerprintSlot` is just the sensor's slot number, recorded for reference only.
- `deviceCommands` is a single row per device, not a generic command queue — only one command type (`UNLOCK`) exists today.
- The `deviceCommands` row is created lazily: `POST /doorbell/unlock` upserts it on the first unlock request for a configured `deviceId` (no startup seeding). `deviceId` is validated against the device label map before any write.
- Index `accessEvents.timestamp` — it backs both the "today" counts and the last-30 `recentHistory` query.
- Fingerprint enrollment has no table, endpoint, or event — it is local to the device (see §6.10).

### 2. Shared Types

```ts
type AccessEvent = {
  id: string
  deviceId: string
  deviceLabel: string
  outcome: "GRANTED" | "DENIED" | "ADMIN_UNLOCK"
  fingerprintSlot: number | null // sensor's onboard template slot that matched; null when outcome is "DENIED" or "ADMIN_UNLOCK"
  timestamp: string // ISO 8601 UTC, e.g. "2026-08-05T02:30:00.000Z"
}

type DashboardSummary = {
  accessGrantedToday: number // includes "ADMIN_UNLOCK" events — the door was opened either way
  accessDeniedToday: number
  lastEventAt: string | null // ISO 8601 UTC; null if no access events yet
  recentHistory: AccessEvent[] // newest first, max 30
}

type PendingCommand = {
  command: "UNLOCK" | null // null when no command is pending
}

// JWT payload (issued in sid cookie) — single-user MVP
type TokenPayload = {
  sub: string       // user id
  deviceHash: string
  iss: string
  exp: number
  iat: number
  nonce: string     // random 8-char value so tokens issued in the same second differ
}

type LoginResponse = {
  data: { user: { id: string; username: string } }
  message: string
}

type SessionResponse = {
  user: { username: string }
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
| POST | `/doorbell/access` | API key | ESP32 reports a fingerprint access attempt (granted or denied) |
| GET | `/dashboard/summary` | Session + CSRF + fingerprint | Initial load: stats + last 30 history entries |
| GET | `/doorbell/stream` | Session cookie + fingerprint query | SSE stream of live access events |
| POST | `/doorbell/unlock` | Session + CSRF + fingerprint | Admin requests a manual unlock, independent of fingerprint match |
| GET | `/doorbell/commands` | API key | ESP32 polls for a pending manual-unlock command |

### 4. Route Protection

| Endpoint | Session cookie | CSRF header | Fingerprint | API key |
| --- | --- | --- | --- | --- |
| `POST /auth/login` | — | — | header (required) | — |
| `GET /session/me` | required | required | header | — |
| `DELETE /session/logout` | required | required | header | — |
| `POST /doorbell/access` | — | — | — | required |
| `GET /dashboard/summary` | required | required | header | — |
| `GET /doorbell/stream` | required | — | query param | — |
| `POST /doorbell/unlock` | required | required | header | — |
| `GET /doorbell/commands` | — | — | — | required |

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
  "data": { "user": { "id": "uuid", "username": "admin" } },
  "message": "Logged in successfully"
}
```

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

#### `POST /doorbell/access`

**Headers:** `X-API-Key: <shared-secret>`

**Transport:** HTTPS only in production.

**Request**

```json
{ "deviceId": "front_gate", "outcome": "GRANTED", "fingerprintSlot": 1 }
```

`outcome` is `"GRANTED"`, `"DENIED"`, or `"ADMIN_UNLOCK"` (the last one reported after the ESP32 executes a pending command from `GET /doorbell/commands`). `fingerprintSlot` must be present when `outcome` is `"GRANTED"` and omitted/null for `"DENIED"` or `"ADMIN_UNLOCK"`.

**Response `201`** — access event accepted

```json
{
  "id": "uuid",
  "deviceId": "front_gate",
  "deviceLabel": "Front Gate",
  "outcome": "GRANTED",
  "fingerprintSlot": 1,
  "timestamp": "2026-08-05T02:30:00.000Z"
}
```

**Response `401`** — invalid or missing API key (compared with constant-time equality).

**Response `400`** — unknown `deviceId`, invalid `outcome` value, or `fingerprintSlot` present/missing inconsistent with `outcome`.

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
      "timestamp": "2026-08-05T02:30:00.000Z"
    }
  ]
}
```

`accessGrantedToday` / `accessDeniedToday` count events whose UTC timestamp falls on the current UTC calendar day, split by `outcome`; `accessGrantedToday` includes `"ADMIN_UNLOCK"` events.

#### `POST /doorbell/unlock`

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

**Response `400`** — unknown `deviceId`.

#### `GET /doorbell/commands?deviceId=front_gate`

**Headers:** `X-API-Key: <shared-secret>`

**Response `200`**

```json
{ "command": "UNLOCK" }
```

or, when nothing is pending:

```json
{ "command": null }
```

The backend consumes the command in a **single atomic statement** (e.g. `UPDATE "deviceCommands" SET "pendingUnlockAt" = NULL WHERE "deviceId" = $1 AND "pendingUnlockAt" IS NOT NULL RETURNING` the previous value — or the Prisma equivalent), never a separate read then write. Two overlapping polls therefore can never both receive `"UNLOCK"`.

- If the consumed `pendingUnlockAt` is within `UNLOCK_COMMAND_TTL_SECONDS` (default `60`) of now, the backend returns `"UNLOCK"`.
- If it is older than the TTL, it is still cleared but treated as expired: the response is `{ "command": null }`. This prevents a stale request from opening the door when an offline ESP32 reconnects much later.
- Consumption is fire-and-forget — no retry if the ESP32 fails to act on it.

**Response `401`** — invalid or missing API key.

**Response `400`** — unknown `deviceId`.

#### `GET /doorbell/stream?fingerprint=<fingerprint>`

**Auth:** session cookie (`sid`) sent automatically by the browser; `fingerprint` query param carries the device fingerprint (since `EventSource` cannot send `X-Fingerprint`). Validated by `authenticateSse` — same hash compare as REST, **no CSRF** on this read-only GET. Note: this `fingerprint` is the browser fingerprint used for session binding, unrelated to the physical fingerprint sensor on the door hardware.

**Response:** `text/event-stream`

Each event:

```
event: access
data: {"id":"uuid","deviceId":"front_gate","deviceLabel":"Front Gate","outcome":"GRANTED","fingerprintSlot":1,"timestamp":"2026-08-05T02:30:00.000Z"}
```

SSE payload shape matches `AccessEvent`.

**Heartbeat:** the server writes a comment line (`: ping\n\n`) every **25 seconds** so idle connections are not dropped by proxies or load balancers. Comments are ignored by `EventSource`, so the client sees no event. Responses use `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `X-Accel-Buffering: no`; disable response compression/buffering on this route at the reverse proxy.

**Reconnect:** no event IDs and no replay — a missed event is never re-sent. The browser's `EventSource` reconnects automatically; on reconnect the dashboard refetches `GET /dashboard/summary` to catch up (missed events appear in stats/history only, no toasts).

### 6. Security Requirements

#### 6.1 Session cookies

| Cookie | Attributes |
| --- | --- |
| `sid` | HTTP-only, signed, `SameSite=Lax`, `path=/`, 30-day `Max-Age`. In production: `Secure`, `__Secure-` name prefix, `Domain=<DOMAIN>` |
| `csrfToken` | readable by JS (for double-submit), `SameSite=Lax`, `path=/`, 30-day `Max-Age`. In production: `Secure`, `Domain=<DOMAIN>` (no name prefix) |

CSRF protection: `X-CSRF-Token` header must match the `csrfToken` cookie on all authenticated REST requests (`GET /session/me`, `DELETE /session/logout`, and the mutating dashboard/doorbell routes).

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

#### 6.5 Doorbell API key (`POST /doorbell/access`)

- API key stored in server env (`DOORBELL_API_KEY`), never in client code.
- Compare keys with **constant-time** equality.
- **HTTPS required** in production — ESP32 must use TLS.
- **Known MVP limitation:** a single shared key can assert any configured `deviceId` and `outcome`. Acceptable for this single-device school project; HTTPS and physical custody of the device are the controls — there is no debounce or rate limit on this endpoint.
- `GET /doorbell/commands` reuses this same API key control — no separate auth mechanism for command polling.

#### 6.6 Admin unlock delivery

- `POST /doorbell/unlock` bypasses fingerprint matching entirely, so it is gated by the full dashboard session stack (signed `sid` cookie, CSRF, fingerprint binding) — the same protection as every other dashboard mutation. No additional re-confirmation step (e.g. password re-entry) is required.
- Command delivery is **fire-and-forget**: `pendingUnlockAt` is cleared atomically the moment `GET /doorbell/commands` is polled, regardless of whether the ESP32 successfully completes the physical unlock afterward. There is no retry, no delivery confirmation back to the admin, and no queueing of multiple pending unlocks — a second click while one is already pending just resets the same timestamp.
- **Commands expire.** A pending unlock older than `UNLOCK_COMMAND_TTL_SECONDS` (default 60) is discarded when polled instead of executed, so an ESP32 that was offline cannot open the door on reconnect long after the admin's click. The admin sees nothing and simply clicks "Unlock Door" again.
- Known MVP limitation: if the ESP32 is offline, or loses power right after consuming the command, the unlock is silently lost with no error surfaced to the dashboard. Acceptable for this single-device school project.

#### 6.7 SSE fingerprint in query string

Fingerprint in the SSE URL increases exposure via server logs and browser history. Required mitigations:

- **Do not log query strings** for `/doorbell/stream` on the reverse proxy / API server (primary control for fingerprint leakage).
- **Frontend `Referrer-Policy: no-referrer`** — set on the Vue dashboard only, **not** on Hono API responses. Tells the browser not to send a `Referer` header when the user navigates away from the dashboard to an external site. Set via `<meta name="referrer" content="no-referrer">` in `index.html`, or as an HTTP response header on the static host serving the SPA (Vite dev server, nginx, Netlify, etc.).
- `SameSite=Lax` on `sid` prevents cross-site sites from opening a credentialed `EventSource` to the API.
- CSRF is intentionally omitted on this read-only GET; cookie + fingerprint binding is the control.

#### 6.8 Error codes (auth-related)

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | Wrong username/password on login |
| `INVALID_USERNAME` | 400 | Empty or blank `username` on login |
| `INVALID_PASSWORD` | 400 | Empty or blank `password` on login |
| `INVALID_DEVICE_ID` | 400 | Missing or invalid fingerprint (login and authenticated routes) |
| `INVALID_BODY` | 400 | Request body missing or not valid JSON |
| `VALIDATION_ERROR` | 400 | Input failed schema validation; field details in `error.issues` |
| `SESSION_UNAUTHORIZED` | 401 | Missing session cookie, missing/mismatched CSRF token, fingerprint mismatch, or user no longer exists |
| `TOKEN_EXPIRED` | 401 | Session JWT is past its `exp` |
| `TOKEN_INVALID` | 401 | Session JWT is malformed, has a bad signature, or the wrong issuer |
| `SERVER_ERROR` | 500 | Unexpected server failure (no internal details exposed) |

#### 6.9 Error response envelope

All errors use the `ApiError` shape from §2: `{ "error": { "code", "message", "field?", "data?", "issues?" } }`. The frontend switches on `error.code`. Only `VALIDATION_ERROR` includes `issues`, as `[{ "path": "username", "message": "..." }]`. Unmatched routes return `404 NOT_FOUND` in the same envelope.

#### 6.10 Fingerprint enrollment (outside the API)

Enrolling a finger is a **local, offline** operation on the device and has no API surface:

- The owner connects a laptop to the ESP32 over USB-serial, physically present, and runs the enrollment routine in the firmware. It scans the same finger twice, merges the scans into one template, and stores it in a numbered slot on the sensor's onboard flash (e.g. `storeModel(slot)` in the Adafruit_Fingerprint library). The OLED shows the prompts; the buzzer/LEDs confirm the result.
- No endpoint, no `accessEvents` row, no SSE event, and no database write — enrollment is not an access attempt.
- The backend only ever learns a slot number later, as `fingerprintSlot` on a `GRANTED` event. Mapping slots to people is kept by the owner offline.
- Because enrollment needs USB-serial access, physical custody of the device is the control; there is no remote enrollment path.

See [[System Documentation#5. Fingerprint Enrollment]].

**Related Docs: [[System Documentation]] & [[System Design Documentation]] & [[Wireframe & Flows]]**
