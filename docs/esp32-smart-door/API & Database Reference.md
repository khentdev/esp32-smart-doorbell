## API & Database Reference

Source of truth for the database schema, shared types, endpoint list, request/response bodies, and route protection rules. Mirror shared types as TypeScript in the backend and frontend (e.g. `Backend/src/types/api.ts`, `Frontend/src/types/api.ts`). Keep code in sync with this doc when the contract changes.

**Naming:** Database columns, API JSON bodies, and shared TypeScript types all use **camelCase**.

### 1. Database Schema (MVP)

```
users
- id              (PK)
- username        (unique)
- hashedPassword
- createdAt
- updatedAt

presses
- id              (PK)
- deviceId        (string)
- timestamp       (datetime, UTC, server-generated)
```

- One admin `users` row is seeded at setup. No self-service registration.
- No `devices` table — labels come from backend config (see [[System Design Documentation#4. Device Label Map]]).
- No `settings` table — sound preferences live client-side.
- No `acknowledged` fields — history is a log, not a task list.

### 2. Shared Types

```ts
type PressEvent = {
  id: string
  deviceId: string
  deviceLabel: string
  timestamp: string // ISO 8601 UTC, e.g. "2026-08-05T02:30:00.000Z"
}

type DashboardSummary = {
  pressesToday: number
  pressesAllTime: number
  lastPressAt: string | null // ISO 8601 UTC; null if no presses yet
  recentHistory: PressEvent[] // newest first, max 30
}

// JWT payload (issued in sid cookie) — single-user MVP
type TokenPayload = {
  sub: string       // user id
  deviceHash: string
  iss: string
  exp: number
}
```

### 3. API Endpoints

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public + fingerprint header | Validate credentials, issue session |
| GET | `/session/me` | Session + CSRF + fingerprint | Validate/rotate current session |
| POST | `/auth/logout` | Session + CSRF + fingerprint | Clear session cookies |
| POST | `/doorbell/press` | API key | ESP32 reports a button press |
| GET | `/dashboard/summary` | Session + CSRF + fingerprint | Initial load: stats + last 30 history entries |
| GET | `/doorbell/stream` | Session cookie + fingerprint query | SSE stream of live press events |

### 4. Route Protection

| Endpoint | Session cookie | CSRF header | Fingerprint | API key |
| --- | --- | --- | --- | --- |
| `POST /auth/login` | — | — | header (required) | — |
| `GET /session/me` | required | required | header | — |
| `POST /auth/logout` | required | required | header | — |
| `POST /doorbell/press` | — | — | — | required |
| `GET /dashboard/summary` | required | required | header | — |
| `GET /doorbell/stream` | required | — | query param | — |

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
{ "username": "admin" }
```

Sets `sid` (HTTP-only, signed) and `csrfToken` cookies. JWT includes `deviceHash = hash(fingerprint)`.

**Response `401`**

```json
{ "error": "INVALID_CREDENTIALS", "message": "Invalid username or password" }
```

**Response `400`**

```json
{ "error": "INVALID_DEVICE_ID", "message": "Invalid device fingerprint." }
```

#### `GET /session/me`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `200`**

```json
{ "username": "admin" }
```

If less than 1 day remains before JWT expiry, response includes refreshed `Set-Cookie` headers with a new `sid` and `csrfToken` (extended expiry). See §6.4.

**Response `202`**

```json
{ "error": "TOKEN_STILL_ROTATING", "message": "Token still rotating. Please try requesting again." }
```

Returned when a concurrent rotation is in progress. Client should retry after a short delay.

**Response `401`**

```json
{ "error": "SESSION_UNAUTHORIZED" }
```

Fingerprint mismatch or invalid/expired session.

#### `POST /auth/logout`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `204`** — clears **both** `sid` and `csrfToken` cookies.

#### `POST /doorbell/press`

**Headers:** `X-API-Key: <shared-secret>`

**Transport:** HTTPS only in production.

**Request**

```json
{ "deviceId": "front_gate" }
```

**Response `201`** — press accepted

```json
{
  "id": "uuid",
  "deviceId": "front_gate",
  "deviceLabel": "Front Gate",
  "timestamp": "2026-08-05T02:30:00.000Z"
}
```

**Response `204`** — press debounced (within 3s of previous accepted press for this `deviceId`); no body.

**Response `401`** — invalid or missing API key (compared with constant-time equality).

**Response `400`** — unknown `deviceId`.

#### `GET /dashboard/summary`

**Headers:** `X-CSRF-Token`, `X-Fingerprint`

**Response `200`**

```json
{
  "pressesToday": 3,
  "pressesAllTime": 142,
  "lastPressAt": "2026-08-05T02:30:00.000Z",
  "recentHistory": [
    {
      "id": "uuid",
      "deviceId": "front_gate",
      "deviceLabel": "Front Gate",
      "timestamp": "2026-08-05T02:30:00.000Z"
    }
  ]
}
```

`pressesToday` counts presses whose UTC timestamp falls on the current UTC calendar day.

#### `GET /doorbell/stream?fingerprint=<fingerprint>`

**Auth:** session cookie (`sid`) sent automatically by the browser; `fingerprint` query param carries the device fingerprint (since `EventSource` cannot send `X-Fingerprint`). Validated by `authenticateSse` — same hash compare as REST, **no CSRF** on this read-only GET.

**Response:** `text/event-stream`

Each event:

```
event: press
data: {"id":"uuid","deviceId":"front_gate","deviceLabel":"Front Gate","timestamp":"2026-08-05T02:30:00.000Z"}
```

SSE payload shape matches `PressEvent`.

### 6. Security Requirements

#### 6.1 Session cookies

| Cookie | Attributes |
| --- | --- |
| `sid` | HTTP-only, signed, `SameSite=Lax`, `Secure` in production, `path=/` |
| `csrfToken` | readable by JS (for double-submit), `SameSite=Lax`, `Secure` in production, `path=/` |

CSRF protection: `X-CSRF-Token` header must match the `csrfToken` cookie on all mutating REST requests and on `GET /session/me`.

#### 6.2 Login protection

- Use generic `"Invalid username or password"` — do not reveal whether the username exists.
- Seeded admin password must meet a minimum strength requirement at setup (document in deployment README).

#### 6.3 Device fingerprint

- Client generates fingerprint on first visit (e.g. ThumbmarkJs or equivalent) and stores the **canonical JSON string** in session storage.
- Sent as `X-Fingerprint` header on login and all authenticated REST calls.
- Server rejects fingerprints that are empty, non-JSON, arrays, or trivially weak (e.g. fewer than 3 top-level keys).
- At login, server computes `deviceHash = hash(fingerprint)` and embeds it in the JWT. All subsequent requests must present the same fingerprint; mismatch → `401 SESSION_UNAUTHORIZED`.
- **Token theft mitigation:** a stolen `sid` cookie alone is not enough — the attacker must also present the matching fingerprint from the same browser. Combined with HTTPS, this is the primary session security control for this MVP. No server-side token revocation list (`jti`) is used.

#### 6.4 JWT rotation

- Default session lifetime: 30 days (`JWT_REFRESH_TOKEN_EXPIRES_IN`).
- Rotation trigger: less than 1 day remains before `exp` on `GET /session/me`.
- On rotation: issue new `sid` + `csrfToken` with extended expiry. No server-side revocation of the previous token — it remains valid until its original `exp`, but is unusable without the bound fingerprint.
- Concurrent rotation requests: second caller receives `202 TOKEN_STILL_ROTATING`; client retries after ~500ms.
- Logout clears cookies client-side; no server-side token blacklist.

#### 6.5 Doorbell API key (`POST /doorbell/press`)

- API key stored in server env (`DOORBELL_API_KEY`), never in client code.
- Compare keys with **constant-time** equality.
- **HTTPS required** in production — ESP32 must use TLS.
- **Known MVP limitation:** a single shared key can assert any configured `deviceId`. Acceptable for this single-device school project; backend debounce (3s) is the only burst control needed.

#### 6.6 SSE fingerprint in query string

Fingerprint in the SSE URL increases exposure via server logs and browser history. Required mitigations:

- **Do not log query strings** for `/doorbell/stream` on the reverse proxy / API server (primary control for fingerprint leakage).
- **Frontend `Referrer-Policy: no-referrer`** — set on the Vue dashboard only, **not** on Hono API responses. Tells the browser not to send a `Referer` header when the user navigates away from the dashboard to an external site. Set via `<meta name="referrer" content="no-referrer">` in `index.html`, or as an HTTP response header on the static host serving the SPA (Vite dev server, nginx, Netlify, etc.).
- `SameSite=Lax` on `sid` prevents cross-site sites from opening a credentialed `EventSource` to the API.
- CSRF is intentionally omitted on this read-only GET; cookie + fingerprint binding is the control.

#### 6.7 Error codes (auth-related)

| Code | HTTP | When |
| --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | Wrong username/password on login |
| `INVALID_DEVICE_ID` | 400 | Malformed or weak fingerprint on login |
| `SESSION_UNAUTHORIZED` | 401 | Missing/invalid session, CSRF mismatch, fingerprint mismatch, or expired JWT |
| `TOKEN_STILL_ROTATING` | 202 | Concurrent rotation in progress on `/session/me` |

**Related Docs: [[System Documentation]] & [[System Design Documentation]] & [[Wireframe & Flows]]**
