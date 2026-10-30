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
  - Toast appears with device label, outcome, and absolute datetime (user's local timezone), styled differently for granted, denied, and admin unlock
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
- Each row/card shows: device label, outcome, the person's name for a granted scan (falls back to "Slot N" if the slot isn't enrolled in the database), + absolute datetime (user's local timezone)
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

### 8. Manage Fingerprints

- Settings shows a **Fingerprints** section, loaded via `GET /fingerprints?deviceId=front_gate`
  - Each row: the person's name and when they were added, with Rename and Delete actions. Slot numbers are not shown
  - On empty → show "No fingerprints enrolled yet"
  - If an enroll/delete is already running (e.g. after a page reload) → show its live progress instead of the add form
- **Add a person**
  - Admin types a name (1–40 characters) and clicks "Add fingerprint" → `POST /fingerprints`
    - Name already used → `409 FINGERPRINT_NAME_TAKEN`, show inline error, stay on form
    - Another job running → `409 FINGERPRINT_JOB_IN_PROGRESS`, show "Another fingerprint task is in progress"
    - All slots used → `409 FINGERPRINT_SLOTS_FULL`, show "The sensor is full"
  - On `202` → show "Waiting for the door…" (the ESP32 picks the job up within ~3 s)
  - As SSE `fingerprint` events arrive, show the same prompts the OLED shows at the door:
    1. "Place finger on the sensor"
    2. "Remove finger"
    3. "Place the same finger again"
  - **Success** → the person appears in the list, success toast
  - **Failure** → show the reason with a "Try again" button:
    - `MISMATCH` → "The two scans didn't match"
    - `TIMEOUT` → "No finger was placed in time"
    - `BAD_IMAGE` → "The sensor couldn't read the finger"
    - `STORE_FAILED` → "The sensor couldn't save the fingerprint"
    - `DEVICE_TIMEOUT` → "The door stopped responding"
  - **Expired** (no pickup within 60 s) → "The door is offline. Check its power and WiFi, then try again"
- **Rename** → inline edit, `PATCH /fingerprints/:id`. Saved immediately; past history keeps the old name
- **Delete** → confirm dialog ("Remove Juan? They will no longer be able to open the door"), then `DELETE /fingerprints/:id`
  - The row shows "Removing…" until the ESP32 confirms, then disappears with a toast
  - On failure or expiry → the row stays, with an error toast
- Only one enroll or delete runs at a time; the add form and delete buttons are disabled meanwhile
- On SSE reconnect → refetch `GET /fingerprints` (missed progress events are not replayed)

## Session

---

### 9. Logout

- User clicks Logout in top bar
- Client calls `DELETE /session/logout` with `X-CSRF-Token` + `X-Fingerprint` headers
- Server clears **both** `sid` and `csrfToken` cookies
- Redirect to Login page
- Any attempt to revisit dashboard without valid session → redirect to Login

### 10. Session Expiry / Auto-Rotation

- On app load → `GET /session/me` validates current session (with `X-CSRF-Token` + `X-Fingerprint` headers)
- If session valid but less than 1 hour remains before expiry → JWT rotates automatically in background (new cookies issued with extended expiry), user stays logged in
- If session invalid/expired → redirect to Login, show no error (just land on login form)

## At the Door (during enrollment)

- When the ESP32 receives an `ENROLL` command, the OLED walks the person through it:
  - "Place finger" → person scans (short beep)
  - "Remove finger"
  - "Place same finger again" → person scans again (short beep)
  - On success → "Enrolled!", double beep
  - On failure → the reason (e.g. "Prints did not match"), long beep; the admin retries from Settings
- Each step waits up to 20 seconds for a finger, then fails with `TIMEOUT`
- Normal scanning is paused while an enroll or delete runs
- No access event is generated — enrollment is not an access attempt

## Device Setup (one time)

- Fingers enrolled over USB before dashboard enrollment existed are unknown to the database
- Upload the `wipe-fingerprints` firmware env, confirm in the Serial Monitor to clear the sensor, then upload `app` again and re-enroll everyone from Settings (see [[Hardware Setup Guide]])

**Related Docs: [[System Documentation]] & [[System Design Documentation]] & [[API & Database Reference]]**
