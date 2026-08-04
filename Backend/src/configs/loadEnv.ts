import "./initializeDotEnv.js"

const loadEnvVar = <T extends string>(value: T, fallbackData?: T) => {
    const envValue = process.env[value]
    if (envValue !== undefined) return envValue
    if (fallbackData !== undefined) return fallbackData
    throw new Error(`Environment variable: ${value} is required but not defined. Please check your .env file.`)
}
export default loadEnvVar