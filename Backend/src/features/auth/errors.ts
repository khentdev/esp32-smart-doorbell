import type { ErrorDefinitions } from "../../errors/index.js";

export const AUTH_ERROR_CODES = {
INVALID_DEVICE_ID: "INVALID_DEVICE_ID",
} as const

export const AUTH_ERROR_DEF: Record<AuthErrorCodes, ErrorDefinitions> = {
    INVALID_DEVICE_ID: {
        code: "INVALID_DEVICE_ID",
        message: "Unable to verify your device. Please refresh the page and try again.",
        status: 400,
    },
} as const

export type AuthErrorCodes = keyof typeof AUTH_ERROR_CODES