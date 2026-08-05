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
- Three stat cards: **Presses Today**, **Presses All-Time**, **Last Press**
  - Loaded on mount via `GET /dashboard/summary` (with `X-CSRF-Token` + `X-Fingerprint` headers), then updated live via SSE as new presses arrive
  - **Today:** counted in UTC on server; empty → show `"0"`
  - **All-Time:** empty → show `"No presses yet"`
  - **Last Press:** relative time in user's local timezone (e.g. `Just now`, `5 minutes ago`); ticks every minute; empty → show `—`

### 3. Live Notification (Toast)

- Triggered automatically when the backend accepts a press and broadcasts it via SSE
  - Toast appears with device label + absolute datetime (user's local timezone)
  - Sound plays simultaneously (default preset: **chime**, unless user saved a different preference)
  - Toast auto-dismisses after a few seconds — no user action needed
- SSE connects via `GET /doorbell/stream?fingerprint=<fingerprint>` (cookie sent automatically)
- Backend debounces presses within 3 seconds — debounced presses are not saved and do not produce a toast
- If SSE connection drops → "Disconnected" status shown in top bar, auto-reconnect attempted in background
- On reconnect → refetch `GET /dashboard/summary`, restore "Live" status; missed presses appear in stats/history only (no replay toasts)

### 4. Press History

- Scrollable list below/beside stat cards, most recent press first
- Shows the last **30** entries only (no pagination)
- Each row/card shows: device label + absolute datetime (user's local timezone)
- On empty (no presses yet) → show `"No notifications yet"`
- List updates in real-time as new presses arrive (same SSE stream as toast)

## Settings

---

### 5. Notification Sound

- User opens Settings page
- Dropdown shows preset sound options (chime, bell, alert tone)
- Default on first visit: **chime**
- User selects a preset → preview/test button plays it before saving
- On save → preference stored in local storage, applies to all future toasts immediately

### 6. Custom Sound Upload

- User selects "Upload custom sound" → file picker opens
- User picks an audio file
  - If file type is not `.mp3`/`.wav` → show error "Unsupported file type"
  - If file exceeds size/duration limit → show error "File too large" (max 5MB / 5 seconds)
  - On valid file → preview/test button plays uploaded clip
- On save → file stored in IndexedDB, preference set to "custom" in local storage

## Session

---

### 7. Logout

- User clicks Logout in top bar
- Client calls `POST /auth/logout` with `X-CSRF-Token` + `X-Fingerprint` headers
- Server clears **both** `sid` and `csrfToken` cookies
- Redirect to Login page
- Any attempt to revisit dashboard without valid session → redirect to Login

### 8. Session Expiry / Auto-Rotation

- On app load → `GET /session/me` validates current session (with `X-CSRF-Token` + `X-Fingerprint` headers)
- If session valid but less than 1 day remains before expiry → JWT rotates automatically in background (new cookies issued with extended expiry), user stays logged in
- If `202 TOKEN_STILL_ROTATING` → client retries after ~500ms
- If session invalid/expired → redirect to Login, show no error (just land on login form)

**Related Docs: [[System Documentation]] & [[System Design Documentation]] & [[API & Database Reference]]**
