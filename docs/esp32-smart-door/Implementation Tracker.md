# Implementation Tracker

Build order for the API and its frontend integration. Contracts live in [[API & Database Reference]]; design decisions in [[System Design Documentation]]. Tick a box only when the endpoint (or screen) works **and** has tests.

Legend: `[x]` done · `[ ]` todo · each backend task lists its test cases; each frontend task names the endpoint it integrates.

---

## Backend (`Backend-hono/src/features/*`)

### Foundation
- [x] Auth: `POST /auth/login`
- [x] Session: `GET /session/me`, `DELETE /session/logout`
- [x] Prisma contract: `AccessEvent`, `DeviceCommand` models + migration
- [x] Device label map (`src/config/devices.ts`, `Object.hasOwn` check)

### B1. Manual unlock — `POST /door/unlock` (session)
- [x] Route, controller, service, data (`features/door/`)
- [x] Tests: 202 + row upsert, repeat unlock resets timestamp, unknown/prototype/missing `deviceId` → 400, all auth failures → no row written

### B2. Device API-key middleware
- [x] Add `DEVICE_API_KEY` to `config/env.ts` and `.env.example`
- [x] `middleware/authenticateDevice.ts`: constant-time compare, `401` on missing/wrong key (add error code + definition)
- [x] Tests: missing key, wrong key, valid key passes

### B3. Device polling — `GET /door/commands?deviceId=` (API key)
- [x] Add `UNLOCK_COMMAND_TTL_SECONDS` (default 60) to `env.ts`
- [x] Data fn: atomic consume of `pendingUnlockAt` (single statement; check what ORM `update` returns on no match)
- [x] Service: `UNLOCK` if within TTL, else `null`; unknown `deviceId` → 400
- [x] Tests: unlock → poll returns `UNLOCK`; second poll `null`; expired → `null` and cleared; two concurrent polls → exactly one `UNLOCK`; no row → `null`; bad/missing key → 401; unknown device → 400

### B4. Access reporting — `POST /door/access` (API key)
- [x] Zod body schema: `deviceId`, `outcome` (`GRANTED | DENIED | ADMIN_UNLOCK`), `fingerprintSlot` (required for `GRANTED` only)
- [x] Insert `AccessEvent`; unknown device → 400
- [x] Publish event to the SSE broadcaster (stub the publisher until B6)
- [x] Tests: each outcome persisted; `GRANTED` without slot → 400; slot on `DENIED` rejected/ignored per docs; bad key → 401

### B5. Dashboard summary — `GET /dashboard/summary` (session)
- [ ] New `features/dashboard/` (read-only; imports from `door`/events, owns no door logic)
- [ ] Today's UTC counts (`accessGrantedToday` includes `ADMIN_UNLOCK`), last 30 events with `deviceLabel`
- [ ] Tests: counts split by outcome, UTC day boundary, history capped at 30 and newest-first, unauthenticated → 401

### B6. Live stream — `GET /door/stream` (SSE)
- [ ] `authenticateSse` middleware (session cookie + fingerprint **query** param, no CSRF)
- [ ] In-memory broadcaster; stream new `AccessEvent`s; heartbeat; cleanup on disconnect
- [ ] Tests: auth failures, event published by B4 arrives on stream

### B7. Hardening / docs
- [ ] Invalid/missing JSON body on `POST /door/unlock` → 400 (currently unhandled `c.req.json()`)
- [ ] Update [[API & Database Reference]] if any contract changed
- [ ] Full suite green: `bun run test`

---

## Frontend (Vue dashboard)

Depends on the backend task named in brackets.

### F0. Setup
- [ ] Scaffold Vue app (`Frontend/`), router, API client with `credentials: "include"`
- [ ] Shared types mirrored from the API doc (`Frontend/src/types/api.ts`)
- [ ] Fingerprint generator + `X-Fingerprint` header; CSRF token read from cookie → `X-CSRF-Token`
- [ ] Error handling keyed on `error.code`; `<meta name="referrer" content="no-referrer">`

### F1. Login [`POST /auth/login`]
- [ ] Login form, validation errors from `VALIDATION_ERROR.issues`
- [ ] Redirect to dashboard on success

### F2. Session handling [`GET /session/me`, `DELETE /session/logout`]
- [ ] Route guard using `/session/me`; clear state on 401
- [ ] Logout button (clear local state even on `401 TOKEN_EXPIRED`)

### F3. Dashboard page [B5 `GET /dashboard/summary`]
- [ ] Stat cards (granted / denied today)
- [ ] Recent history list (last 30, device label, outcome, time)

### F4. Unlock button [B1 `POST /door/unlock`]
- [ ] Button per device; handle `202`, `400`, `401`
- [ ] Pending state (command is fire-and-forget; result arrives via stream)

### F5. Live feed [B6 `GET /door/stream`]
- [ ] `EventSource` with fingerprint query param; reconnect handling
- [ ] Prepend new events to history, bump counts, toast on events

### F6. Polish
- [ ] Empty / loading / error states
- [ ] Responsive layout check

---

## End-to-end checks
- [ ] Dashboard unlock → ESP32 polls (B3) → `ADMIN_UNLOCK` reported (B4) → appears live on dashboard (B6/F5)
- [ ] Fingerprint granted/denied on device → appears live and in summary counts
- [ ] Offline ESP32: stale unlock expires and does not fire on reconnect
