# Smart Door Dashboard (Vue 3)

Minimalist, responsive dashboard for the ESP32 smart door: login, live access feed (SSE), manual unlock and notification-sound settings. Structure follows `docs/esp32-smart-door/frontend-structure-reference.md`; contracts live in `docs/esp32-smart-door/API Contract.md`.

```bash
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:3000
bun install
bun run dev            # http://localhost:5173 (must match FRONTEND_DEV_URL / CORS in the backend)
bun run build          # vue-tsc type-check + production build
bun run lint
```

Start the backend (`Backend-hono`, `bun run dev`) first. Simulate the device with `POST /door/access` (`X-API-Key`) to see live toasts.
