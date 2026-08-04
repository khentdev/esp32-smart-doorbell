import type { ErrorDefinitions } from "../../errors/index.js";


export const SESSION_ERROR_CODES = {
    SESSION_UNAUTHORIZED: "SESSION_UNAUTHORIZED",
    TOKEN_STILL_ROTATING: "TOKEN_STILL_ROTATING",
} as const

export const SESSION_ERROR_DEF: Record<SessionErrorCode, ErrorDefinitions> = {
    SESSION_UNAUTHORIZED: {
        code: "SESSION_UNAUTHORIZED",
        status: 401,
        message: "Your session is invalid or has expired. Please log in again."
    },
    TOKEN_STILL_ROTATING: {
        code: "TOKEN_STILL_ROTATING",
        status: 202,
        message: "Token still rotating. Please try requesting again."
    }
}

export type SessionErrorCode = keyof typeof SESSION_ERROR_CODES