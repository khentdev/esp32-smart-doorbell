export function loadEnvVar(key: string, fallback?: string) {
  const value = Bun.env[key];
  if (value !== undefined) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Environment variable ${key} is required but not defined.`);
}

export const env = {
  PORT: loadEnvVar("PORT", "3000"),
  NODE_ENV: loadEnvVar("NODE_ENV", "development"),

  ADMIN_USERNAME: loadEnvVar("ADMIN_USERNAME", "admin"),
  ADMIN_PASSWORD: loadEnvVar("ADMIN_PASSWORD", "admin123"),

  DOMAIN_NAME: loadEnvVar("DOMAIN", "localhost"),
  FRONTEND_PROD_URL: loadEnvVar("FRONTEND_PROD_URL"),
  FRONTEND_DEV_URL: loadEnvVar("FRONTEND_DEV_URL"),

  JWT_SECRET: loadEnvVar("JWT_SECRET", "your-512-secret-length"),
  JWT_REFRESH_TOKEN_EXPIRES_IN: loadEnvVar(
    "JWT_REFRESH_TOKEN_EXPIRES_IN",
    "2592000",
  ),
  JWT_ISSUER: loadEnvVar("JWT_ISSUER", "app-local"),

  COOKIE_SECRET: loadEnvVar("COOKIE_SECRET", "your-cookie-secret"),
  HASH_SECRET: loadEnvVar("HASH_SECRET", "your-hash-secret"),
} as const;
