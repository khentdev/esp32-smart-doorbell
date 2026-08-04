import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AUTH_ERROR_CODES, AUTH_ERROR_DEF } from "../features/auth/errors.js";
import { SESSION_ERROR_CODES, SESSION_ERROR_DEF } from "../features/session/errors.js";

export type ErrorDefinitions = {
    code: ErrorCodes,
    status: ContentfulStatusCode,
    message: string,
}

export type AppErrorOptions = {
    cause?: string,
    field?: string,
    data?: Record<string, any>
    messageOverride?: string
}

export const FEATURE_ERROR_CODES = {
    // Spread Error Codes here from features
    ...AUTH_ERROR_CODES,
    ...SESSION_ERROR_CODES,
    SERVER_ERROR: "SERVER_ERROR",
    TOKEN_INVALID: "TOKEN_INVALID",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    USER_NOT_FOUND: "USER_NOT_FOUND",
} as const

export const FEATURE_ERROR_DEFINITIONS: Record<ErrorCodes, ErrorDefinitions> = {
    /**
     * e.g. ...AUTH_ERROR_DEF
     */
    ...AUTH_ERROR_DEF,
    ...SESSION_ERROR_DEF,
    TOKEN_INVALID: {
        code: "TOKEN_INVALID",
        status: 401,
        message: "Invalid or malformed token."
    },
    TOKEN_EXPIRED: {
        code: "TOKEN_EXPIRED",
        status: 401,
        message: "Token has expired."
    },
    SERVER_ERROR: {
        code: "SERVER_ERROR",
        status: 500,
        message: "Something went wrong on our end. Please try again later."
    },
    USER_NOT_FOUND: {
        code: "USER_NOT_FOUND",
        message: "Your session is invalid or has expired. Please log in again.",
        status: 404,
    },
}

export type ErrorCodes = (typeof FEATURE_ERROR_CODES)[keyof typeof FEATURE_ERROR_CODES]