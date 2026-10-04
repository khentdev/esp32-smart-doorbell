import { getTestDatabaseUrl } from "./testDatabase";

// Force the isolated test DB so .env's dev DATABASE_URL is never used.
Bun.env.DATABASE_URL = getTestDatabaseUrl();

// Defaults so config/env.ts does not throw when .env lacks these.
Bun.env.FRONTEND_PROD_URL ??= "http://localhost:5173";
Bun.env.FRONTEND_DEV_URL ??= "http://localhost:5173";
