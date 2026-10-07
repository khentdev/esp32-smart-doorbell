## Auth

---

### 1. Login

- On page load, client generates a browser fingerprint (e.g. ThumbmarkJs) and stores canonical JSON in session storage
- User fills login form (username, password) and submits
  - Both fields required
  - Client sends `X-Fingerprint` header with the stored fingerprint
  - If fingerprint is invalid → `400`, show error, stay on form
  - If username or password is invalid → `401`, show "Invalid username or password", stay on form
  - On success → server issues `sid` + `csrfToken` cookies bound to fingerprint, redirect to dashboard

## Dashboard

---

### 2. View Dashboard

- Default landing page after login
- On first load, set `Referrer-Policy: no-referrer` in Vue `index.html` (`<meta name="referrer" content="no-referrer">`) — frontend only, not the API backend; prevents the browser from sending a `Referer` header when the user navigates to external sites
- "Unlock Door" button in the top bar — lets the admin trigger a manual unlock without a fingerprint match (see flow 5)
- Three stat cards: **Granted Today**, **Denied Today**, **Last Event**
  - Loaded on mount via `GET /dashboard/summary` (with `X-CSRF-Token` + `X-Fingerprint` headers), then updated live via SSE as new access events arrive
  - **Granted Today / Denied Today:** counted in UTC on server; empty → show `"0"`
  - **Last Event:** relative time in user's local timezone (e.g. `Just now`, `5 minutes ago`); ticks every minute; empty → show `—`

### 3. Live Notification (Toast)

- Triggered automatically when the backend accepts an access event and broadcasts it via SSE
  - Toast appears with device label, outcome, and absolute datetime (user's local timezone), styled differently for granted vs denied
  - Sound plays simultaneously (default preset: **chime**, unless user saved a different preference)
  - Toast auto-dismisses after a few seconds — no user action needed
- SSE connects via `GET /door/stream?fingerprint=<fingerprint>` (cookie sent automatically; this `fingerprint` is the browser fingerprint used for session binding, unrelated to the physical fingerprint scan that produced the event)
- No debounce — every scan result (granted or denied) is saved and produces a toast; a denied attempt is security-relevant and must not be suppressed
- Server sends a `: ping` heartbeat every 25s (invisible to the UI) to keep the connection alive
- If SSE connection drops → "Disconnected" status shown in top bar, auto-reconnect attempted in background
- On reconnect → refetch `GET /dashboard/summary`, restore "Live" status; missed events appear in stats/history only (no replay toasts)

### 4. Access History

- Scrollable list below/beside stat cards, most recent event first
- Shows the last **30** entries only (no pagination)
- Each row/card shows: device label, outcome, + absolute datetime (user's local timezone)
- On empty (no access events yet) → show `"No notifications yet"`
- List updates in real-time as new events arrive (same SSE stream as toast)

### 5. Admin Manual Unlock

- Admin clicks "Unlock Door" in the top bar — available any time the dashboard is loaded, no confirmation dialog
- Client calls `POST /door/unlock` with `X-CSRF-Token` + `X-Fingerprint` headers
  - On success → `202`, show a brief "Unlock requested" toast/status (the door hasn't opened yet at this point)
  - If session invalid → `401`, redirect to Login like any other authenticated action
- A few seconds later (ESP32 polls on a ~3s interval), the resulting access event arrives through the normal SSE path (flow 3) with outcome **Admin Unlock**, styled distinctly from a fingerprint match, and the stat cards/history update exactly as they would for a granted fingerprint scan
- There is no dashboard indicator for "still waiting on the device" beyond that eventual toast — if the ESP32 is offline, the request waits up to 60 seconds, then expires silently (it is never executed late); the admin can click "Unlock Door" again

## Settings

---

### 6. Notification Sound

- User opens Settings page
- Dropdown shows preset sound options (chime, bell, alert tone)
- Default on first visit: **chime**
- User selects a preset → preview/test button plays it before saving
- On save → preference stored in local storage, applies to all future toasts immediately

### 7. Custom Sound Upload

- User selects "Upload custom sound" → file picker opens
- User picks an audio file
  - If file type is not `.mp3`/`.wav` → show error "Unsupported file type"
  - If file exceeds size/duration limit → show error "File too large" (max 5MB / 5 seconds)
  - On valid file → preview/test button plays uploaded clip
- On save → file stored in IndexedDB, preference set to "custom" in local storage

## Session

---

### 8. Logout

- User clicks Logout in top bar
- Client calls `DELETE /session/logout` with `X-CSRF-Token` + `X-Fingerprint` headers
- Server clears **both** `sid` and `csrfToken` cookies
- Redirect to Login page
- Any attempt to revisit dashboard without valid session → redirect to Login

### 9. Session Expiry / Auto-Rotation

- On app load → `GET /session/me` validates current session (with `X-CSRF-Token` + `X-Fingerprint` headers)
- If session valid but less than 1 hour remains before expiry → JWT rotates automatically in background (new cookies issued with extended expiry), user stays logged in
- If session invalid/expired → redirect to Login, show no error (just land on login form)

## Device Setup
 
- Owner triggers the enrollment routine on the device
  - OLED prompts "Place finger" → user scans
  - OLED prompts "Remove finger"
  - OLED prompts "Place same finger again" → user scans again
  - On success → sensor stores the template in the next available onboard flash slot, OLED/buzzer confirm success
  - On failure (e.g. scans don't match) → OLED/buzzer prompt a retry
- No access event is generated and no request reaches the backend — enrollment never touches PostgreSQL

**Related Docs: [[System Documentation]] & [[System Design Documentation]] & [[API & Database Reference]]**
