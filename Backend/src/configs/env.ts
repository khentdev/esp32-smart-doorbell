import loadEnvVar from "./loadEnv.js";

export const env = {
    NODE_ENV: loadEnvVar("NODE_ENV", "development"),
    PORT: 3003,
    DATABASE_URL: loadEnvVar("DATABASE_URL"),

    DOMAIN_NAME: loadEnvVar("DOMAIN_NAME", "localhost"),
    FRONTEND_PROD_URL: loadEnvVar("FRONTEND_URL", "http://localhost:4173"),
    FRONTEND_DEV_URL: loadEnvVar("FRONTEND_DEV_URL", "http://localhost:5173"),

    HASH_SECRET: loadEnvVar("HASH_SECRET", "your-256-secret-length"),
    COOKIE_SECRET: loadEnvVar("COOKIE_SECRET", "your-256-secret-length"),
    JWT_ISSUER: loadEnvVar("JWT_ISSUER", "your-domain"),
    JWT_SECRET: loadEnvVar("JWT_SECRET", "your-512-secret-length"),
} as const
export type Env = typeof env