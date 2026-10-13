import { getTestDatabaseUrl } from "./testDatabase";

// Force the isolated test DB so .env's dev DATABASE_URL is never used.
Bun.env.DATABASE_URL = getTestDatabaseUrl();

// Defaults so config/env.ts does not throw when .env lacks these.
Bun.env.FRONTEND_PROD_URL ??= "http://localhost:5173";
Bun.env.FRONTEND_DEV_URL ??= "http://localhost:5173";

// Short SSE heartbeat so stream tests can observe a `: ping` without waiting 25s.
// Forced (not `??=`) so a developer's .env can't make the heartbeat test time out.
Bun.env.SSE_HEARTBEAT_SECONDS = "0.05";
