type EnvKey = 'VITE_API_URL'

const defaults: Partial<Record<EnvKey, string>> = {
  VITE_API_URL: 'http://localhost:3000',
}

/** Reads a Vite env var, falling back to a dev default; throws if neither exists. */
export function LoadEnv(key: EnvKey): string {
  const value = (import.meta.env[key] as string | undefined) ?? defaults[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value.replace(/\/+$/, '')
}
