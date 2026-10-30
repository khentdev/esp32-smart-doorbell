## System Design

### 1. Architecture Overview

```
[Fingerprint Sensor] --UART--> [ESP32] --I2C--> [OLED]
                                   |----GPIO----> [Buzzer + LEDs]
                                   |----GPIO----> [Relay] --12V (separate supply)--> [Solenoid Lock]
                                   |----PWM (direct)-----------------------------> [MG996R Servo] <--5V (separate USB charger)
                                   |
                                   |  POST /door/access (API key) -------\
                                   |  GET  /door/commands (API key, poll ~3s) <---\
                                   |  POST /door/jobs/:jobId/progress (API key)      |
                                   v                                                   |
                              [Hono Backend] ---- Prisma ---- [PostgreSQL]             |
                                   |                    ^                              |
                                   | SSE (access + fingerprint events)                 |
                                   v                    | POST /door/unlock, /fingerprints*
                              [Vue Dashboard] -----------(session + CSRF)--------------/
```

- **Fingerprint Sensor** — the sole biometric input trigger. Captures and matches a scan against templates stored on its own onboard flash, and reports match/no-match to the ESP32 over UART. Replaces the push button.
- **ESP32** — reads the scan result, drives the two actuators on a match (relay → solenoid unlock, then servo open/close), shows status on the OLED and buzzer/LEDs throughout, and sends a minimal HTTPS POST to the backend with an API key reporting the outcome. It also polls the backend every ~3 seconds for a pending command — an admin unlock (runs the same actuator sequence), or a fingerprint enroll/delete job (runs the enrollment prompts or wipes a slot, reporting each step back). It holds no state and does no timestamping.
- **Hono Backend** — receives the access event, stamps the timestamp, persists it via Prisma to PostgreSQL, resolves the device label from a static config map, and broadcasts the event to any connected dashboard clients over SSE. No debounce step. Also accepts admin-unlock requests and fingerprint enroll/rename/delete requests from the dashboard, queues device work for the ESP32's next poll, and relays the device's enrollment progress to the dashboard over SSE.
- **PostgreSQL** — stores the access event history (source of truth), the single pending-unlock flag per device, the enrolled people (name ↔ sensor slot), and fingerprint jobs. Fingerprint templates are never stored here — they live only on the sensor's onboard flash.
- **Vue Dashboard** — loads existing state on mount via REST, then subscribes to SSE for live updates (toast + sound + stat/history updates) for the rest of the session. Also exposes an "Unlock Door" action that requests a manual unlock independent of the fingerprint sensor, and a Settings → Fingerprints section to enroll, name, list, and delete people.

See [[API & Database Reference]] for the database schema, endpoint list, request/response contracts, route protection rules, and security requirements.

### 2. Data Flow

**Access event (hardware → dashboard)**

1. User places a finger on the fingerprint sensor.
2. ESP32 reads the match/no-match result over UART from the sensor.
3. **Match:** ESP32 triggers the relay → solenoid releases; after the lock fully releases, the servo swings the door open; after a hold period, the servo closes the door and the solenoid re-locks. OLED/buzzer/LED show "Access granted" throughout.
4. **No match:** no physical actuation occurs. OLED/buzzer/LED show "Access denied".
5. Either way, ESP32 sends `POST /door/access` over HTTPS with `X-API-Key` and body `{ "deviceId": "front_gate", "outcome": "GRANTED" | "DENIED", "fingerprintSlot": <number | omitted> }` (`fingerprintSlot` present only when `outcome` is `GRANTED`).
6. Backend validates the API key (constant-time compare), generates the timestamp server-side (UTC), looks up the enrolled person's name for `fingerprintSlot` (stored on the event as `fingerprintName`, a snapshot), inserts a row into the `accessEvents` table, resolves `deviceLabel` from the static config map, and broadcasts the event to all connected SSE clients. No debounce step — every scan result is recorded.
7. Dashboard receives the SSE event, shows a toast styled by outcome (with sound), updates stat cards, and prepends the entry to the history list.

**Admin manual unlock (dashboard → hardware)**

1. Admin clicks "Unlock Door" on the dashboard.
2. Dashboard sends `POST /door/unlock` with session cookie, `X-CSRF-Token`, and `X-Fingerprint` headers, body `{ "deviceId": "front_gate" }`.
3. Backend upserts the device's `deviceCommands` row with `pendingUnlockAt = now()` and responds `202`.
4. On its next poll (~3 second interval), ESP32 calls `GET /door/commands?deviceId=front_gate` with `X-API-Key`. Backend atomically clears `pendingUnlockAt` to `null` (consumed, fire-and-forget). If the cleared value was set within the last `UNLOCK_COMMAND_TTL_SECONDS` (default 60) it returns `{ "command": "UNLOCK" }`; if it was older, the command is expired and it returns `{ "command": null }`.
5. ESP32 runs the same actuator sequence as a fingerprint match (relay → solenoid release, servo open, hold, servo close, re-lock); OLED/buzzer/LED show an admin-unlock status.
6. ESP32 reports the result via the same `POST /door/access` endpoint with `"outcome": "ADMIN_UNLOCK"` (`fingerprintSlot` omitted).
7. Backend persists and broadcasts it like any other access event; dashboard shows a toast styled for this outcome and counts it toward Granted Today.

Delivery is fire-and-forget: if the ESP32 is slow to poll, the request waits in `pendingUnlockAt` for at most the TTL (60s by default). If the ESP32 is offline longer than that, the request expires and is discarded on the next poll — there is no retry or notification back to the admin, who simply clicks "Unlock Door" again.

**Fingerprint enrollment (dashboard → hardware → dashboard)**

1. Admin opens Settings → Fingerprints, types the person's name, and clicks "Add fingerprint".
2. Dashboard sends `POST /fingerprints` (session + CSRF + fingerprint) with `{ "deviceId": "front_gate", "name": "Juan" }`. Backend picks the lowest free sensor slot (1–127), creates a `PENDING` `ENROLL` job in `fingerprintJobs`, responds `202`, and broadcasts the job over SSE.
3. On its next poll, ESP32 calls `GET /door/commands`. With no pending unlock, the backend atomically claims the job (`PENDING` → `SENT`) and returns `{ "command": "ENROLL", "jobId", "slot" }`.
4. ESP32 runs the enrollment prompts on the OLED — "Place finger" → "Remove finger" → "Place same finger again" — and reports each step to `POST /door/jobs/:jobId/progress`. The backend relays every step to the dashboard over SSE, so Settings shows the same prompts live.
5. Sensor merges the two scans and stores the template in the assigned slot. ESP32 reports `SUCCEEDED` (or `FAILED` with `MISMATCH`, `TIMEOUT`, `BAD_IMAGE`, `STORE_FAILED`).
6. On success the backend inserts the `fingerprints` row (slot ↔ name) in the same transaction that marks the job `SUCCEEDED`. No access event is generated — enrollment is not an access attempt.

**Fingerprint delete / rename**

- **Delete:** `DELETE /fingerprints/:id` creates a `DELETE` job for that slot; the ESP32 picks it up on its next poll, wipes the slot (`deleteModel`), and reports the result. The `fingerprints` row is removed only after the device confirms, so a failed delete leaves the person listed.
- **Rename:** `PATCH /fingerprints/:id` changes the name in PostgreSQL only — the sensor stores no names, so the device is not involved. Past access events keep the name they had at scan time.

Only one fingerprint job per device can be active (`PENDING` or `SENT`) at a time. A job nobody picks up within `UNLOCK_COMMAND_TTL_SECONDS` (60s — the ESP32 is offline) becomes `EXPIRED`; a picked-up job with no final report within `FINGERPRINT_JOB_TIMEOUT_SECONDS` (120s — the ESP32 lost power or WiFi mid-flow) becomes `FAILED` with `DEVICE_TIMEOUT`. Both are computed whenever jobs are read or polled; there is no background timer.

**Dashboard load (on mount)**

1. Dashboard calls `GET /dashboard/summary` to fetch current state: access granted today, access denied today, last event, and the most recent 30 history entries.
2. Dashboard opens an SSE connection to `GET /door/stream?fingerprint=<fingerprint>` for events going forward.
3. REST covers "everything up to now," SSE covers "everything from now on" — the two are never used to duplicate the same data.

**SSE reconnect**

1. The server sends a `: ping` comment every 25 seconds so idle connections survive proxies. If the connection drops anyway, the dashboard shows "Disconnected" and retries in the background.
2. On reconnect, the dashboard refetches `GET /dashboard/summary` to restore any access events missed during downtime.
3. Missed events do not replay as toasts; they appear in stats and history only.

**Auth**

1. Client generates a browser fingerprint and stores it in session storage.
2. User submits username + password to `POST /auth/login` with `X-Fingerprint` header.
3. Backend validates credentials, computes `deviceHash`, issues a JWT (`sid` cookie) with `deviceHash`, plus a `csrfToken` cookie.
4. On each app load, `GET /session/me` validates the session; JWT rotates automatically when less than 1 hour remains before expiry (new token with extended expiry issued).
5. Logout clears both `sid` and `csrfToken` cookies.

### 3. Key Technical Decisions

| Decision | Why |
| --- | --- |
| SSE instead of polling or WebSockets | The dashboard only needs one-directional, low-latency push (server → browser) for notifications. SSE gives instant delivery without the overhead/complexity of a two-way WebSocket channel. |
| Backend stamps the timestamp, not the ESP32 | ESP32 has no real-time clock without adding NTP sync. The backend already has accurate system time, so the access-event payload stays minimal. |
| No debounce on access events | The button-era 3-second debounce guarded against a held or mashed button. The fingerprint sensor has a false-reject rate under 1%, so an immediate rescan after a failed read is normal legitimate behavior, not spam — suppressing it would hide real denied/retry activity from the owner. Every scan result is recorded and broadcast. |
| Fingerprint templates stored on the sensor's onboard flash, not PostgreSQL | Templates are proprietary binary data matched entirely on the sensor itself. Duplicating them in Postgres would add complexity with no feature depending on it, and keeps biometric data off the server. |
| Servo driven directly by ESP32 GPIO, no relay | The servo takes a logic-level PWM signal only. A relay is needed solely to switch the solenoid's separate 12V/higher-current circuit, which GPIO cannot drive directly. |
| Solenoid driven through a relay on a separate 12V supply | ESP32 GPIO cannot supply the solenoid's 12V/0.6A draw. The relay isolates logic-level control from the power circuit. |
| Fingerprint enrollment triggered from the dashboard, not over USB-serial | Originally local/offline only. Changed so the owner can add, name, and remove people without a laptop at the door. It reuses the existing poll channel (`GET /door/commands`) rather than adding a push connection, and the person still has to be physically at the sensor to scan. |
| Sensor slot chosen by the backend (lowest free, 1–127) | The admin never handles slot numbers, and an existing person can't be overwritten by typing the wrong number. |
| Enrolled people stored as name ↔ slot in PostgreSQL; templates stay on the sensor | Names are what the owner reads in history; the biometric template still never leaves the sensor. |
| `fingerprintName` snapshot on each access event | History stays truthful after a person is renamed or deleted and their slot is reused. |
| Fingerprint work modeled as a `fingerprintJobs` table with a status | Enrollment is multi-step and reports progress, success, or a failure reason — a single timestamp can't hold that. One active job per device keeps it simple. |
| Job expiry computed on read, not by a background timer | Same approach as the unlock TTL: no scheduler, and a stuck job resolves itself the next time the dashboard or the ESP32 asks. |
| Enroll/delete use session + CSRF + fingerprint, no re-confirmation | Same trust level as `POST /door/unlock`, which can already open the door. |
| Admin unlock delivered via ESP32 polling, not a push/WebSocket channel | Keeps the ESP32's communication model symmetric — plain HTTP requests only, same as `/door/access`. A persistent connection (WebSocket, reverse-SSE) would be new infrastructure for a feature that's used occasionally, not continuously. |
| Pending unlock stays a single nullable timestamp per device | `UNLOCK` has no steps or result to track, so it keeps its simple atomic-consume model. It always takes priority over a pending fingerprint job on the same poll. |
| Unlock command consumed at poll time, not at confirmed execution | Fire-and-forget, the same precedent as missed SSE events not being replayed. Acceptable risk for an occasional manual-override path at this MVP scale — if the ESP32 is mid-poll-cycle when it loses power, the admin can simply click "Unlock Door" again. |
| Unlock command consumed atomically and expires after `UNLOCK_COMMAND_TTL_SECONDS` (60s) | The timestamp is already stored, so a TTL costs nothing. Without it, a click made while the ESP32 is offline would open the door unexpectedly whenever it reconnects. Atomic consume (single `UPDATE ... RETURNING`) stops overlapping polls from both receiving `UNLOCK`. |
| No login rate limiting or lockout | The API is deployed privately and is not publicly exposed, with one admin account. Accepted MVP limitation; revisit before any public exposure. |
| SSE `: ping` comment every 25s | Keeps idle connections from being dropped by reverse proxies; comments are invisible to `EventSource`, so no client code changes. |
| ~3 second poll interval for `GET /door/commands` | Balances perceived latency (a few seconds of delay is acceptable for a manual override) against request volume, which is negligible for a single device. |
| `POST /door/unlock` uses session + CSRF + fingerprint only, no re-confirmation | Consistent with how every other dashboard mutation is protected in this MVP. The session is already fingerprint-bound to the one trusted admin account — adding a password re-entry step would be a new auth pattern used nowhere else. |
| `ADMIN_UNLOCK` counts toward Granted Today, no separate stat card | The door was physically opened either way. The history list's per-row `outcome` already distinguishes a manual unlock from a fingerprint match, so a 4th stat card would duplicate that distinction without adding information. |
| Static `deviceId` → label map in backend config | The device is physically fixed at one door for this MVP. A config map gives human-readable labels without a `devices` table or hardware-side complexity. |
| API key on `POST /door/access` | ESP32 cannot use session cookies. A shared secret in firmware is enough for this single-device school MVP, with HTTPS as the main transport control. |
| Cookie-only SSE + fingerprint in query | `EventSource` cannot send custom headers (`X-CSRF-Token`, `X-Fingerprint`). The session cookie authenticates the stream; `fingerprint` query param carries the device fingerprint for binding validation. CSRF is not required on this read-only GET; mitigations documented in [[API & Database Reference#6.7 SSE fingerprint in query string]]. |
| Separate `authenticateSse` middleware | Existing `authenticate` requires CSRF header + `X-Fingerprint` header, which `EventSource` cannot send. SSE route uses cookie + query fingerprint only. |
| Device fingerprint binding in JWT | Stolen `sid` cookie alone is insufficient — attacker must also present the matching fingerprint from the same browser. Combined with HTTPS, this is the primary session theft control. No `jti` revocation list needed for this MVP. |
| JWT rotation (extend expiry) | Keeps active users logged in without re-entering credentials. Old token remains valid until its original `exp`, but is bound to the same fingerprint. |
| Refetch summary on SSE reconnect | SSE has no backlog. A REST refetch is the simplest way to catch up after downtime without replaying toasts. |
| Granted/Denied Today counted in UTC | Server-side counting stays consistent regardless of client timezone. The client converts timestamps to the user's local timezone for display. |
| History capped at last 30 entries | Enough context for the dashboard without pagination complexity at MVP scale. |
| No retention/cleanup policy on `accessEvents` | The table grows unbounded in PostgreSQL — the 30-entry cap bounds only the dashboard's `recentHistory` display, not the data. At single-household MVP scale, unbounded storage isn't a cost or performance concern, so no cron/scheduled deletion job is introduced. |
| Sound preference in local storage; custom uploads in IndexedDB | No need to round-trip a preference through the backend/database. Tradeoff: preference is device/browser-specific and won't sync across devices. |
| Fetch-on-mount + SSE, not SSE-only | SSE only delivers events that occur after the connection opens. An initial REST fetch is required to populate existing stats/history on page load. |
| Simplified JWT claims (single-user MVP) | Token payload is `sub`, `deviceHash`, `iss`, `iat`, `exp`, and a random `nonce` (so two tokens issued in the same second differ). No tenant or role claims. |

### 4. Device Label Map

Static config in the backend (e.g. env or config file):

```ts
const DEVICE_LABELS = {
  front_gate: "Front Gate",
} as const
```

- `deviceId` from the ESP32 must match a key in this map (checked with `Object.hasOwn`, so `constructor`/`__proto__` are rejected). This map is the only source of known devices; anything else is unknown (tests use `back_door` as an unknown id).
- Unknown `deviceId` → reject the event with `400`.
- MVP deploys one physical device with one hardcoded `deviceId`; the map exists for human-readable labels only.

### 5. Non-Goals / Explicitly Not Scalable

This system is scoped as a single-user, single-device MVP, not a production or scalable system:

- No multi-tenant support — one house, one owner, one login
- No multi-device management UI — `deviceId` is hardcoded on the ESP32, not dynamically registered
- No per-device API keys — single shared key for the one ESP32 (HTTPS is the main control; see [[API & Database Reference#6.5 Device API key (`POST /door/access`)]])
- No horizontal scaling considerations for SSE (a single backend instance holding open connections is sufficient at this scale)
- No cross-device sync for sound preferences (client-side storage only)
- No role-based access control — a single fixed admin account is the only user
- No paginated history — dashboard shows the last 30 entries only
- No multiple fingers per person — each enrolled person is one finger in one sensor slot
- No dashboard accounts for enrolled people — they only open the door; the single admin manages them
- No enrollment job queue — one fingerprint job per device at a time; a second request is rejected until the first finishes
- No automatic data retention/cleanup — `accessEvents` is never pruned; the 30-entry cap applies to the dashboard display only
- No real-time push to the ESP32 — admin-unlock command delivery is poll-based with ~3s latency, not instant
- No login rate limiting or lockout — acceptable only while the deployment stays private (not publicly exposed)

### 6. Auth Middleware

Two middleware paths — do not reuse `authenticate` for SSE.

| Middleware | Used on | Validates |
| --- | --- | --- |
| `authenticate` | REST: `/session/me`, `/session/logout`, `/dashboard/summary`, `/door/unlock`, `/fingerprints*` | Signed `sid` cookie, `X-CSRF-Token` header matches `csrfToken` cookie, `X-Fingerprint` header matches JWT `deviceHash`, JWT not expired |
| `authenticateSse` | SSE: `/door/stream` | Signed `sid` cookie, `fingerprint` query param matches JWT `deviceHash`, JWT not expired. No CSRF. |

**Related Docs: [[System Documentation]] & [[Wireframe & Flows]] & [[API & Database Reference]]**
