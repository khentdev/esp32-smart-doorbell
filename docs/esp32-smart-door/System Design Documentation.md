## System Design

### 1. Architecture Overview

```
[ESP32 + Button + Buzzer]
        |  HTTPS POST + API key (deviceId)
        v
   [Hono Backend] ---- Prisma ---- [PostgreSQL]
        |
        | SSE (broadcast on new press)
        v
   [Vue Dashboard]
```

- **ESP32** — detects a button press, sends a minimal HTTPS POST to the backend with an API key, and locally sounds its buzzer. It holds no state and does no timestamping.
- **Hono Backend** — receives the press event, debounces if needed, stamps the timestamp, persists it via Prisma to PostgreSQL, resolves the device label from a static config map, and broadcasts the event to any connected dashboard clients over SSE.
- **PostgreSQL** — stores the press history (source of truth).
- **Vue Dashboard** — loads existing state on mount via REST, then subscribes to SSE for live updates (toast + sound + stat/history updates) for the rest of the session.

See [[API & Database Reference]] for the database schema, endpoint list, request/response contracts, route protection rules, and security requirements.

### 2. Data Flow

**Press event (hardware → dashboard)**

1. User presses the physical button.
2. ESP32 sends `POST /doorbell/press` over HTTPS with `X-API-Key` and body `{ "deviceId": "front_gate" }`.
3. Backend validates the API key (constant-time compare).
4. If the press falls within 3 seconds of the previous accepted press for that `deviceId`, the backend ignores it (no DB insert, no SSE broadcast).
5. Otherwise, backend generates the timestamp server-side (UTC), inserts a row into the `presses` table, resolves `deviceLabel` from the static config map, and broadcasts the event to all connected SSE clients.
6. Dashboard receives the SSE event, shows a toast (with sound), updates stat cards, and prepends the entry to the history list.

**Dashboard load (on mount)**

1. Dashboard calls `GET /dashboard/summary` to fetch current state: presses today, presses all-time, last press, and the most recent 30 history entries.
2. Dashboard opens an SSE connection to `GET /doorbell/stream?fingerprint=<fingerprint>` for events going forward.
3. REST covers "everything up to now," SSE covers "everything from now on" — the two are never used to duplicate the same data.

**SSE reconnect**

1. If the SSE connection drops, the dashboard shows "Disconnected" and retries in the background.
2. On reconnect, the dashboard refetches `GET /dashboard/summary` to restore any presses missed during downtime.
3. Missed presses do not replay as toasts; they appear in stats and history only.

**Auth**

1. Client generates a browser fingerprint and stores it in session storage.
2. User submits username + password to `POST /auth/login` with `X-Fingerprint` header.
3. Backend validates credentials, computes `deviceHash`, issues a JWT (`sid` cookie) with `deviceHash`, plus a `csrfToken` cookie.
4. On each app load, `GET /session/me` validates the session; JWT rotates automatically when less than 1 day remains before expiry (new token with extended expiry issued).
5. Logout clears both `sid` and `csrfToken` cookies.

### 3. Key Technical Decisions

| Decision | Why |
| --- | --- |
| SSE instead of polling or WebSockets | The dashboard only needs one-directional, low-latency push (server → browser) for notifications. SSE gives instant delivery without the overhead/complexity of a two-way WebSocket channel. |
| Backend stamps the timestamp, not the ESP32 | ESP32 has no real-time clock without adding NTP sync. The backend already has accurate system time, so the press payload stays minimal (`deviceId` only). |
| Backend debounce within 3 seconds | Prevents a held or mashed button from spamming the database, SSE, toasts, and sounds. Debounced presses are fully ignored — not logged, not broadcast. |
| Static `deviceId` → label map in backend config | The device is physically fixed at one door for this MVP. A config map gives human-readable labels without a `devices` table or hardware-side complexity. |
| API key on `POST /doorbell/press` | ESP32 cannot use session cookies. A shared secret in firmware is enough for this single-device school MVP, with HTTPS as the main transport control. Backend debounce (3s) already limits burst spam from a held button. |
| Cookie-only SSE + fingerprint in query | `EventSource` cannot send custom headers (`X-CSRF-Token`, `X-Fingerprint`). The session cookie authenticates the stream; `fingerprint` query param carries the device fingerprint for binding validation. CSRF is not required on this read-only GET; mitigations documented in [[API & Database Reference#6.6 SSE fingerprint in query string]]. |
| Separate `authenticateSse` middleware | Existing `authenticate` requires CSRF header + `X-Fingerprint` header, which `EventSource` cannot send. SSE route uses cookie + query fingerprint only. |
| Device fingerprint binding in JWT | Stolen `sid` cookie alone is insufficient — attacker must also present the matching fingerprint from the same browser. Combined with HTTPS, this is the primary session theft control. No `jti` revocation list needed for this MVP. |
| JWT rotation (extend expiry) | Keeps active users logged in without re-entering credentials. Old token remains valid until its original `exp`, but is bound to the same fingerprint. |
| Refetch summary on SSE reconnect | SSE has no backlog. A REST refetch is the simplest way to catch up after downtime without replaying toasts. |
| Presses Today counted in UTC | Server-side counting stays consistent regardless of client timezone. The client converts timestamps to the user's local timezone for display. |
| History capped at last 30 entries | Enough context for the dashboard without pagination complexity at MVP scale. |
| Sound preference in local storage; custom uploads in IndexedDB | No need to round-trip a preference through the backend/database. Tradeoff: preference is device/browser-specific and won't sync across devices. |
| Fetch-on-mount + SSE, not SSE-only | SSE only delivers events that occur after the connection opens. An initial REST fetch is required to populate existing stats/history on page load. |
| Simplified JWT claims (single-user MVP) | Token payload is `sub`, `deviceHash`, `iss`, `exp` only. Remove leftover `tenantId` / `STAFF` role from backend template at implementation. |

### 4. Device Label Map

Static config in the backend (e.g. env or config file):

```ts
const DEVICE_LABELS: Record<string, string> = {
  front_gate: "Front Gate",
  back_door: "Back Door",
}
```

- `deviceId` from the ESP32 must match a key in this map.
- Unknown `deviceId` → reject the press with `400`.
- MVP deploys one physical device with one hardcoded `deviceId`; the map exists for human-readable labels only.

### 5. Non-Goals / Explicitly Not Scalable

This system is scoped as a single-user, single-device MVP, not a production or scalable system:

- No multi-tenant support — one house, one owner, one login
- No multi-device management UI — `deviceId` is hardcoded on the ESP32, not dynamically registered
- No per-device API keys — single shared key for the one ESP32 (HTTPS + backend debounce are the controls; see [[API & Database Reference#6.5 Doorbell API key (`POST /doorbell/press`)]])
- No horizontal scaling considerations for SSE (a single backend instance holding open connections is sufficient at this scale)
- No cross-device sync for sound preferences (client-side storage only)
- No role-based access control — a single fixed admin account is the only user
- No paginated history — dashboard shows the last 30 entries only

### 6. Auth Middleware

Two middleware paths — do not reuse `authenticate` for SSE.

| Middleware | Used on | Validates |
| --- | --- | --- |
| `authenticate` | REST: `/session/me`, `/auth/logout`, `/dashboard/summary` | Signed `sid` cookie, `X-CSRF-Token` header matches `csrfToken` cookie, `X-Fingerprint` header matches JWT `deviceHash`, JWT not expired |
| `authenticateSse` | SSE: `/doorbell/stream` | Signed `sid` cookie, `fingerprint` query param matches JWT `deviceHash`, JWT not expired. No CSRF. |

**Related Docs: [[System Documentation]] & [[Wireframe & Flows]] & [[API & Database Reference]]**
