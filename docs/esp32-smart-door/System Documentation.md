##### Overview

|Field|Details|
|---|---|
|**Project Name**|Smart Doorbell|
|**Type**|Web Application|
|**Purpose**|To notify the owner of the house if someone is at the door|
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
- Automatic JWT rotation when less than 1 day remains before expiry (new token issued with extended expiry)
- Logout clears **both** `sid` and `csrfToken` cookies

**Business Rules**

- Session lifetime defaults to 30 days; rotation triggers in the final 24 hours
- Concurrent rotation returns `202 TOKEN_STILL_ROTATING`; client retries after a short delay
- Token theft mitigation: stolen `sid` cookie is useless without the matching browser fingerprint (HTTPS + device binding)
- Fingerprint mismatch or expired session → redirect to login

#### 2. Dashboard Management

---

**Features**

- Top bar showing app title, live SSE connection status ("Live" / "Disconnected"), and logout
- Stat cards: Presses Today, Presses All-Time, Last Press (relative time, ticks every minute)
- Every button press emitted live to dashboard via SSE, with toast notification + sound alert
- Toast shows device label and absolute datetime, auto-dismisses after a few seconds, no manual action required
- Read-only history list of the most recent notifications (last 30), most recent first

**Business Rules**

- Timestamps are server-stamped in UTC when the request is received, not sent by the ESP32
- **Presses Today** is counted in UTC on the server; the dashboard may display dates in the user's local timezone where relevant
- Every press is logged automatically — no acknowledgment step, history is a log, not a task list
- Each accepted press fires its own toast + sound, in order received
- Presses within 3 seconds of the previous one are debounced **on the backend** — the press is not saved, no SSE event is sent, and stats do not change
- Device labels (e.g. `front_gate` → "Front Gate") come from a static map in backend config
- SSE uses a separate auth path (cookie + fingerprint query param); Vue dashboard sets `Referrer-Policy: no-referrer` in `index.html` (frontend only — not the API backend); reverse proxy must not log query strings on `/doorbell/stream`
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

#### 4. ESP32 / Doorbell Ingest

---

**Business Rules**

- ESP32 authenticates with `X-API-Key` header; HTTPS required in production
- API key compared with constant-time equality; stored in server environment only
- Single shared key is an accepted limitation for this single-device school project (see [[API & Database Reference#6.5 Doorbell API key (`POST /doorbell/press`)]]); backend debounce (3s) handles burst presses from a held button

**Related Docs: [[Wireframe & Flows]] & [[System Design Documentation]] & [[API & Database Reference]]**
