# PTCI Pageant Tabulation — Frontend Structure

## 1. Overview

| Item | Value |
| --- | --- |
| Framework | Vue 3 (`<script setup lang="ts">`, Composition API) |
| Build tool | Vite 8 (`@vitejs/plugin-vue`, `vite-plugin-vue-devtools`) |
| Language | TypeScript (strict, `vue-tsc` type-check on build) |
| State management | Pinia (setup-store style) |
| Routing | Vue Router 5 (history mode, lazy-loaded routes) |
| HTTP | Axios (single instance + interceptors) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Icons | `@lucide/vue` |
| Utilities | VueUse, ThumbmarkJS (device fingerprint), html2canvas-pro + print-js (printing results) |
| Lint/format | ESLint + Oxlint + Prettier (+ tailwind plugin) |
| Deploy | Vercel (`vercel.json` rewrites all paths to `index.html` for SPA routing) |
| Path alias | `@` → `src/` |

It is a **client-side rendered SPA** that talks to the separate `Backend/` REST API using cookie-based sessions.

---

## 2. Directory Tree

```
Frontend/
├── index.html                  # SPA entry HTML (mounts #app)
├── vite.config.ts              # Plugins + "@" alias
├── vercel.json                 # SPA fallback rewrite
├── env.d.ts                    # Typed import.meta.env
├── tsconfig*.json              # App / node TS configs
├── eslint.config.ts, .oxlintrc.json, .prettierrc.json, .editorconfig
├── public/                     # Static files served as-is
│   ├── Females/ candidate1-10.jpg
│   ├── Males/   candidate1-10.jpg
│   ├── TeamLogo/               # black_stallion, green_dragon, purple_hawk, red_vipers, white_wolves
│   └── favicon.ico, crown logo.ico
└── src/
    ├── main.ts                 # createApp + Pinia + Router, mount
    ├── App.vue                 # Root: <router-view> wrapped by AppToast + SessionOverlay
    ├── style.css               # Tailwind import, fonts (Poppins, Lora), global CSS
    │
    ├── api/                    # HTTP layer (infrastructure)
    │   ├── axios/
    │   │   ├── axiosConfig.ts       # axios instance (baseURL by env, withCredentials, 30s timeout)
    │   │   └── axiosInterceptor.ts  # adds X-Fingerprint + X-CSRF-Token; unwraps response.data; redirects to login on session failure
    │   └── errors/
    │       ├── errorHandler.ts      # Normalizes AxiosError → { code, message, type } (offline/timeout/unreachable/server_error)
    │       └── index.ts             # ErrorResponse / ErrorReturnType types
    │
    ├── config/loadEnv.ts       # LoadEnv(key) – throws if env var is missing
    │
    ├── router/                 # Routing, split per role/feature
    │   ├── index.ts                 # Merges routes + global beforeEach guard (auth + role checks)
    │   ├── auth/authRoutes.ts       # /auth/login, 404 catch-all
    │   ├── admin/adminRoutes.ts     # /admin/live/results (+ rounds, categories, contestants, judge, audit-trail, :roundId)
    │   ├── judge/judgeRoutes.ts     # /judge/scoring/:categoriesId
    │   └── candidates/candidatesRoutes.ts  # /candidates (public)
    │
    ├── views/                  # Page-level components (one per route)
    │   ├── auth/loginViews.vue
    │   ├── admin/
    │   │   ├── adminMain.vue        # Admin/Chairman shell (sidebar + <RouterView>)
    │   │   ├── rounds/roundsMain.vue
    │   │   ├── categories/categoriesMain.vue
    │   │   ├── contestants/contestantMain.vue
    │   │   ├── judge/judgeMain.vue
    │   │   ├── auditTrail/auditTrailMain.vue
    │   │   └── live_event/liveEventMain.vue   # Live rankings, tie resolution, print/export
    │   ├── judge/
    │   │   ├── judgeMain.vue        # Judge shell (round/category sidebar)
    │   │   └── judgeScoringMain.vue # Scoring sheet per category
    │   ├── candidates/candidatesMain.vue      # Public candidate gallery
    │   └── errors/notFound.vue
    │
    ├── components/             # Reusable UI, grouped by domain
    │   ├── TheNavbar.vue, TheSidebarLayout.vue   # App-level layout pieces
    │   ├── admin/
    │   │   ├── rounds/       RoundTable, RoundAddModal, RoundEditModal
    │   │   ├── categories/   CategoryTable, CategoryAddModal, CategoryEditModal, CategoryFieldsModal, CategoryFieldsTable
    │   │   ├── contestants/  ContestantTable, ContestantAddModal, ContestantEditModal
    │   │   ├── judge/        JudgeTable, JudgeAddModal, JudgeEditModal, JudgeResetPasswordModal
    │   │   ├── liveEvent/    RankingsTable, RoundSidebar, JudgeSubmissions, TieResolution, PlacementOrderResolution, NotFoundOverlay
    │   │   └── auditTrail/   AuditTrailTable
    │   ├── judge/            JudgeScoringTable, JudgeScoringRoundSidebar, JudgeScoringNotFoundOverlay
    │   ├── candidates/       CandidateFemaleList, CandidateMaleList
    │   ├── shared/           Base* design-system components
    │   │   ├── BaseModal, BaseModalActions, BasePanel, BaseEmptyState, BaseSpinner,
    │   │   │   BaseFetchOverlay, BaseServerErrorOverlay, BaseSidebarLink, BaseSidebarSection
    │   │   ├── modal/        BaseModalFetchOverlay, BaseModalServerErrorOverlay
    │   │   └── table/        BaseTable, BaseTableHeader, BaseTableCell
    │   ├── system/           SessionOverlay, SessionRefreshLoading, SessionRefreshError
    │   └── toast/            AppToast
    │
    ├── stores/                 # Pinia stores — one folder per feature
    │   ├── auth/             authStore.ts + service.ts
    │   ├── admin/
    │   │   ├── adminSetup/
    │   │   │   ├── rounds/        roundStore.ts + service.ts
    │   │   │   ├── category/      categoryStore.ts + service.ts
    │   │   │   ├── contestants/   contestantStore.ts + service.ts
    │   │   │   ├── judge/         judgeStore.ts + service.ts
    │   │   │   └── judge_scoring/ judgeScoring.ts + service.ts
    │   │   ├── adminLive/     liveStore.ts + service.ts
    │   │   └── auditTrail/    auditTrailStore.ts + service.ts
    │   ├── candidates/       candidateStore.ts
    │   └── modals/           modalStore.ts   # Central open/close state for all add/edit modals
    │
    ├── types/                  # TypeScript types mirroring the stores/features
    │   ├── auth/             userAuth.ts, error.ts
    │   ├── admin/…           <feature>.ts (DTOs, inputs, responses) + error.ts (error-code constants & union types)
    │   └── candidates/       candidates.ts
    │
    ├── composables/            # Reusable stateful logic
    │   ├── Toast/            useToast.ts, index.ts   # Global toast queue (max 3, dedup, auto-dismiss)
    │   └── useNetworkStatus.ts                       # Online/offline detection
    │
    ├── utils/                  # Pure helpers
    │   ├── getFingerprint.ts      # Cached ThumbmarkJS device fingerprint
    │   └── getCookieHelper.ts     # Reads non-HttpOnly cookies (CSRF token)
    │
    └── assets/imgs/            # Bundled images (logos, backgrounds, icons)
```

---

## 3. What kind of structure is this?

**A feature/role-based, layered Vue 3 SPA** — closest to a *"layered architecture with feature folders"* (sometimes called a *type-first layout mirrored per feature*).

Instead of keeping everything for one feature in a single folder (pure "feature-sliced"), it separates code by **technical layer** (`views`, `components`, `stores`, `types`, `api`) and then **mirrors the same feature/role hierarchy inside each layer** (e.g. `admin/adminSetup/rounds/` appears in `components`, `stores`, and `types`). That makes it easy to find any feature's pieces by following the same path in each layer.

### Layers and responsibilities

| Layer | Responsibility | Example |
| --- | --- | --- |
| **Views** | Page for a route; composes components, triggers store actions on mount | `roundsMain.vue` calls `roundStore.getRound()` |
| **Components** | Presentational / feature UI (tables, modals, sidebars) | `RoundTable.vue`, `RoundAddModal.vue` |
| **Shared (Base\*)** | Generic design-system building blocks reused everywhere | `BaseModal`, `BaseTable`, `BasePanel` |
| **Stores (Pinia)** | App state + business/UI logic: loading flags, error flags, form errors, toasts | `roundStore.ts` |
| **Service (per store)** | Thin API calls only (`axiosInstance.get/post/patch/delete`) | `rounds/service.ts` |
| **API layer** | Axios setup, interceptors, centralized error normalization | `api/axios/*`, `api/errors/*` |
| **Types** | DTOs, request/response types, and backend error-code constants | `types/.../rounds.ts`, `error.ts` |
| **Composables / Utils** | Cross-cutting reusable logic | `useToast`, `getFingerprint` |

### Data flow (one request, end to end)

```
View (onMounted / click)
  → Store action (sets loading state)
    → service.ts (axiosInstance call)
      → interceptor adds X-Fingerprint + X-CSRF-Token, cookie session sent automatically
    ← response.data returned (interceptor unwraps)
  ← store updates state  /  on error: errorHandler() → code-based form error or toast
← components re-render reactively
```

### Key architectural patterns

1. **Role-based routing** — three audiences: **Admin/Chairman** (`/admin/...`), **Judge** (`/judge/scoring/...`), and **Public** (`/candidates`). A global `beforeEach` guard restores the session (`checkAuth`) and checks `requiresAdmin` / `requiresJudge` / `allowChairman` route meta; per-route `beforeEnter` guards further restrict setup pages to Admin only (Chairman can only see live results / audit).
2. **Nested layouts** — `adminMain.vue` and `judgeMain.vue` are shells (sidebar + `<RouterView>`); pages render inside as child routes.
3. **Lazy-loaded routes** — every view uses `() => import(...)` for code splitting.
4. **Store + Service separation** — stores hold state/logic; `service.ts` holds only HTTP calls; types are kept separate. Each store tracks `loadingStates`, `errorStates`, and `formErrors` for consistent UI behavior.
5. **Centralized error handling** — backend error *codes* (typed per feature in `types/**/error.ts`) are mapped by the store to field-level errors or toasts; infra errors (offline, timeout, unreachable, 5xx) are classified once in `errorHandler.ts`.
6. **Cookie session security** — HttpOnly session cookie + CSRF token header + device fingerprint header; the interceptor redirects to login on session-failure codes.
7. **Session & connectivity overlays** — `SessionOverlay` wraps the whole router view to show refresh-loading/error states and online/offline toasts globally.
8. **Centralized modal state** — `modalStore` holds visibility flags for all add/edit modals instead of each page managing its own.
9. **Reusable Base components** — tables, modals, panels, empty/error/fetch overlays give every admin page a consistent look and loading/error/empty handling.
10. **Result export** — the live event view uses `html2canvas-pro` (+ `print-js`) to capture and print the rankings.

### Role → screen map

| Role | Routes | What they do |
| --- | --- | --- |
| Public | `/candidates` | View male/female candidate lists |
| Auth | `/auth/login` | Login (redirects by role) |
| Admin | `/admin/live/results/{rounds, categories, contestants, judge, audit-trail, :roundId}` | Setup (rounds, categories & criteria fields, contestants, judges/chairman), live results, tie/placement resolution, audit trail |
| Chairman | `/admin/live/results` (live + audit only) | Monitor and resolve results |
| Judge | `/judge/scoring/:categoriesId` | Score contestants per category/round |

---

## 4. Notes / Observations

- Naming is mixed (`loginViews.vue`, `judgeMain.vue` exists in both `views/admin/judge` and `views/judge`, `judgeScoring.ts` store lacks the `Store` suffix) — worth normalizing.
- `modalStore` is growing as features are added; consider splitting per feature or driving modals with local `v-model` state.
- Some route guards repeat the same `isAdmin` check in `adminRoutes.ts`; a shared guard function would reduce duplication.
- `localStorage` is used to hold selected IDs (e.g., `round-id`) between the table and edit modal; passing IDs through the store would be more robust.
