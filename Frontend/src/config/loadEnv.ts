type EnvKey = keyof ImportMetaEnv
export const LoadEnv = (key: EnvKey, fallback?: string) => {
    const value = import.meta.env[key]

    if (value !== undefined) return value
    if (fallback !== undefined) return fallback

    throw new Error(`Missing env variable: ${key}`)
}