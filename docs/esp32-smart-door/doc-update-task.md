# Task: Update Project Documentation for Hardware Scope Change

## Context

This is the Smart Doorbell IoT project. The original concept was a **push button** doorbell: press → ESP32 → HTTP POST → Hono backend → Vue dashboard shows a toast + logs the press.

The teacher requested a scope change. The push button is being **replaced** by a fingerprint-based access control system. All three existing docs were written for the button version and are now out of date.

## Existing docs to update

- `System Documentation` — features + business rules
- `System Design Documentation` — architecture, data flow, technical decisions, schema, endpoints, non-goals
- `Wireframe & Flows` — step-by-step user/system flows

Read all three first before editing any of them. They cross-reference each other; keep them consistent.

## What changed

### Hardware

**Removed:** push button as the trigger.

**New parts being ordered:**
- Fingerprint scanner (R307 or AS608, UART-based)
- 12V solenoid lock — unlocks the door
- MG996R heavy-duty servo — physically swings the door open after unlocking
- 12V 2A power adapter — separate power domain for the solenoid

**Reused from the existing starter kit:**
- ESP32 Development Board
- 0.96" OLED (SSD1306, I2C) — now a core component, used for on-device status text ("Scan your finger", "Access granted", "Access denied", enrollment prompts)
- 5V 2-Channel Relay Module — drives the solenoid (ESP32 GPIO cannot drive 12V directly)
- Active buzzer + LEDs — local audible/visual feedback
- Breadboard, Dupont cables, resistors

**Unused from kit (not part of this project):** obstacle avoidance module, photoresistor, DHT11, PIR motion sensor, potentiometer, passive buzzer, RGB LEDs, button switches.

### New event sequence

1. User scans finger on the fingerprint sensor
2. **Match succeeds:**
   - ESP32 triggers relay → solenoid releases (door unlocked)
   - Brief delay so the lock fully releases
   - ESP32 drives servo → door swings open
   - After a hold period, servo closes the door and the solenoid re-locks
   - Event sent to backend
3. **Match fails:**
   - Nothing happens physically
   - Event still sent to backend (this is a security-relevant event worth notifying on)

### Data model change

The old `presses` table assumed every event was identical (a button press). Events now have outcomes. The schema needs a status/outcome field distinguishing a granted access from a denied one, and the table/model name should be renamed from "press" to something that reflects access events rather than button presses. Rename consistently across schema, endpoints, and all three docs.

Keep the schema minimal in the spirit of the existing MVP scope — do not add fields that aren't used by a documented feature.

### Endpoint changes

- `POST /doorbell/press` becomes an access-event endpoint; payload now carries the outcome (and, if multiple fingerprints are enrolled, which enrolled ID matched)
- `GET /dashboard/summary` stats need rethinking: "Presses Today / All-Time" should become access-event stats that reflect granted vs denied, since that distinction is now the interesting data
- `GET /doorbell/stream` (SSE) unchanged in mechanism, but the event payload now carries outcome so the dashboard can style granted vs denied toasts differently
- Auth endpoints unchanged

### Dashboard changes

- Stat cards should reflect the new event types rather than a single undifferentiated press count
- Toast should visually distinguish granted vs denied
- History list rows should show the outcome alongside device + timestamp

## Decisions already made — carry these into the docs, do not re-litigate

- **ESP32 auth:** static API key sent in an `X-API-Key` header, validated against an env var on the backend. The device has no browser/cookie support, so it cannot use the dashboard's JWT/cookie session auth. Error code `API_KEY_INVALID`, 401, message "Invalid or missing API key."
- **CORS:** applies only to the browser-based dashboard routes, not to the ESP32 endpoint. CORS is browser-enforced and irrelevant to device-originated requests; the API key is the gatekeeper there.
- **Timestamps:** server-stamped on receipt, not sent by the ESP32 (no RTC/NTP on the device).
- **Timestamp display:** "Last event" stat card uses relative time (dayjs `.fromNow()`); toast and history list use absolute time.
- **SSE over polling/WebSockets:** one-directional push is all that's needed; the dashboard never sends real-time data back.
- **Fetch-on-mount + SSE:** `GET /dashboard/summary` populates existing state on mount; SSE handles everything from that point forward. SSE alone cannot populate initial state.
- **No pagination:** history returns the most recent N events (`take: 20`); all-time counts come from separate count queries. Add this to non-goals.
- **Debounce:** the 3-second debounce rule was written for a mashed button. Reconsider whether it still applies to fingerprint scans — a scan takes time and a retry after a failed read is legitimate user behavior, not spam. Either justify keeping it or remove it; don't leave it in unexamined.
- **Sound preference:** preset choice in localStorage, custom uploads in IndexedDB. Device/browser-specific, does not sync. Unchanged by this scope change.
- **Scope stays single-user, single-device, explicitly not scalable.**

## New scope to document (did not exist in the button version)

**Fingerprint enrollment.** This is genuinely new and needs to be documented as its own flow:
- Fingerprint templates are stored on the sensor's own onboard flash, each in a numbered ID slot — not in PostgreSQL
- Enrollment requires scanning the same finger twice
- The OLED + buzzer + LED provide the feedback during enrollment (the sensor module itself has no screen)
- The sensor supports many slots, so multiple fingerprints are technically possible, but MVP scope is one or two enrolled fingers (house owner, maybe one family member) with no multi-user management UI

Decide where enrollment is triggered from and document it. Flag this as an open question in your summary if the trigger mechanism isn't determined by anything already in the docs.

**Two physical actuators.** The architecture diagram currently shows only ESP32 → backend. It needs to show the fingerprint sensor as input and the relay/solenoid + servo as outputs, with the servo driven directly by GPIO (no relay) and the solenoid going through the relay on a separate 12V supply.

## How to do this

1. Read all three docs end to end before changing anything
2. Update each one in place, preserving its existing structure, heading style, and formatting conventions — these are the user's own docs, match their voice
3. Keep the three internally consistent: a decision stated in System Design must match how it's described in System Documentation and in Wireframe & Flows
4. Preserve everything unaffected by this change (auth, session management, sound settings) — don't rewrite what didn't change
5. Add the new technical decisions to the System Design decisions table with the *why*, not just the *what* — that table is the point of the doc

## When done

Report back with:
- What changed in each doc
- Any inconsistencies you found between the three docs while reading them
- Any open questions the scope change raises that the docs can't answer on their own
