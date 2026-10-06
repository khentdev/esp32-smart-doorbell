##### Overview

|Field|Details|
|---|---|
|**Project Name**|Smart Doorbell|
|**Type**|Web Application|
|**Purpose**|To control physical entry via fingerprint access and notify the owner of every access attempt|
|**Target Users**|House owner \| Single User|
|**Tech Stack**|Vue · Hono + Prisma + PostgreSQL (backend)|

##### Core Features (Default MVP)

#### 0. Auth

---

**Features**

- Login with username + password
- Single admin account seeded in the database
- Device fingerprint collected at login and bound to the session

**Business Rules**

- Login returns "invalid username or password" on failure (generic message — does not reveal whether username exists)
- Admin credentials are fixed at setup time (seeded once, not self-service registration); password must meet minimum strength at seed time
- Client must send `X-Fingerprint` header on login; server rejects malformed or weak fingerprints with `400`

#### 1. Session Management

---

**Features**

- Session validated on app load (`GET /session/me`)
- JWT stored in HTTP-only signed cookie (`sid`) with CSRF protection (`csrfToken` cookie + `X-CSRF-Token` header)
- Device fingerprint binding for session security — JWT contains `deviceHash`; every authenticated request must present the matching fingerprint
- Automatic JWT rotation when less than 1 hour remains before expiry (new token issued with extended expiry)
- Logout clears **both** `sid` and `csrfToken` cookies

**Business Rules**

- Session lifetime defaults to 30 days; rotation triggers in the final hour
- Token theft mitigation: stolen `sid` cookie is useless without the matching browser fingerprint (HTTPS + device binding)
- Fingerprint mismatch or expired session → redirect to login

#### 2. Dashboard Management

---

**Features**

- Top bar showing app title, live SSE connection status ("Live" / "Disconnected"), and logout
- "Unlock Door" button — lets the admin unlock without a fingerprint match (see §6)
- Stat cards: Granted Today, Denied Today, Last Event (relative time, ticks every minute)
- Every access attempt (granted, denied, or admin unlock) emitted live to dashboard via SSE, with toast notification + sound alert
- Toast shows device label, outcome, and absolute datetime, visually styled differently per outcome, auto-dismisses after a few seconds, no manual action required
- Read-only history list of the most recent access events (last 30), most recent first, each showing its outcome

**Business Rules**

- Timestamps are server-stamped in UTC when the request is received, not sent by the ESP32
- **Granted Today** / **Denied Today** are counted in UTC on the server; admin-unlock events count toward Granted Today (the door was physically opened either way) — the history list's outcome column still distinguishes them from fingerprint matches. The dashboard may display dates in the user's local timezone where relevant.
- Every access event is logged automatically, regardless of outcome — no acknowledgment step, history is a log, not a task list. A denied attempt is security-relevant and is logged and toasted exactly like a granted one, not suppressed.
- Each accepted event fires its own toast + sound, in order received
- No debounce — unlike a mashed button, a denied fingerprint scan followed by an immediate retry is normal legitimate behavior (the sensor's false-reject rate is under 1%), so every scan result is recorded and shown
- Device labels (e.g. `front_gate` → "Front Gate") come from a static map in backend config
- SSE uses a separate auth path (cookie + fingerprint query param); Vue dashboard sets `Referrer-Policy: no-referrer` in `index.html` (frontend only — not the API backend); reverse proxy must not log query strings on `/doorbell/stream`
- The server sends an SSE heartbeat comment every 25 seconds to keep idle connections alive through proxies
- SSE reconnects automatically if connection drops (e.g. WiFi hiccup, tab backgrounded); on reconnect the dashboard refetches `GET /dashboard/summary` to catch up on missed events

#### 3. Notification Sound Settings

---

**Features**

- Dropdown to select notification sound from a set of presets (chime, bell, alert tone)
- Option to upload a custom notification sound (e.g. a funny clip)
- Preview/test button to hear a sound before saving it
- Selected sound persists across browser sessions (preset: local storage key; custom: audio file stored in IndexedDB, referenced by local storage)

**Business Rules**

- Default preset is **chime** if the user has not picked one yet
- The selected sound is what plays for every toast notification in section 2 — this section just controls _which_ sound, section 2 handles _when_ it plays
- Custom uploads limited to `.mp3`/`.wav`, max file size/duration (e.g. 5MB, 5 seconds) to keep playback snappy
- Sound preference (and any custom upload) is stored in browser local storage/IndexedDB; it is device/browser-specific and does not sync across devices or browsers

#### 4. ESP32 / Access Control Ingest

---

**Features**

- ESP32 reports every fingerprint scan result (granted or denied) to the backend as an access event
- ESP32 also polls the backend periodically for a pending admin-unlock command (see §6)

**Business Rules**

- ESP32 authenticates with `X-API-Key` header; HTTPS required in production
- API key compared with constant-time equality; stored in server environment only
- Single shared key is an accepted limitation for this single-device school project (see [[API & Database Reference#6.5 Doorbell API key (`POST /doorbell/access`)]]); no debounce is needed since there is no held-button failure mode to guard against
- The same API key authenticates both `POST /doorbell/access` (reporting an event) and `GET /doorbell/commands` (polling for a pending unlock)
- Note: the fingerprint scanned here is the physical biometric sensor on the door hardware — unrelated to the browser/device fingerprint used for dashboard session binding in §0/§1

#### 5. Fingerprint Enrollment

---

**Features**

- Enrollment is local and offline: the owner connects a laptop to the ESP32 over USB-serial while physically present at the device and runs the enrollment routine directly — no dashboard or backend involvement
- Enrolling a finger requires scanning the same finger twice in sequence
- The OLED displays enrollment prompts ("Place finger", "Remove finger", "Place same finger again") since the fingerprint sensor itself has no screen; the buzzer and LEDs confirm success or failure

**Business Rules**

- Enrollment does not generate an access event — it is not an access attempt, so nothing is sent to the backend and PostgreSQL is untouched
- Fingerprint templates are stored on the sensor's own onboard flash in numbered slots, never in PostgreSQL
- MVP scope is one or two enrolled fingers (house owner, maybe one family member); there is no multi-user management UI

#### 6. Admin Manual Unlock

---

**Features**

- "Unlock Door" button on the dashboard lets the admin open the door without a fingerprint match — a fallback for visitors who aren't enrolled (e.g. relatives)
- No extra confirmation step (such as re-entering a password) is required beyond the existing dashboard session

**Business Rules**

- Protected by the same session + CSRF + fingerprint auth as every other dashboard mutation — no new auth pattern introduced for this action
- Clicking the button doesn't unlock instantly: it sets a pending-unlock flag that the ESP32 picks up on its next poll (~3 second interval), so there's a brief delay before the door actually opens
- Delivery is fire-and-forget: there is only one pending-unlock slot per device, and it's cleared the moment the ESP32 polls it, regardless of whether the physical unlock actually succeeds
- A pending unlock expires after 60 seconds (`UNLOCK_COMMAND_TTL_SECONDS`): if the ESP32 was offline and polls later than that, the request is discarded rather than opening the door, and the admin clicks "Unlock Door" again
- Login has no rate limiting or lockout — an accepted limitation because the system is deployed privately and not exposed publicly
- Reported back to the backend via the same `POST /doorbell/access` endpoint as a fingerprint scan, with outcome `"ADMIN_UNLOCK"` — it appears in history and counts toward Granted Today like any other successful access

**Related Docs: [[Wireframe & Flows]] & [[System Design Documentation]] & [[API & Database Reference]]**
