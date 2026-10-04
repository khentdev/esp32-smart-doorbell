import type { ErrorDefinitions } from "../../errors/index.js";

export const SESSION_ERROR_CODES = {
  SESSION_UNAUTHORIZED: "SESSION_UNAUTHORIZED",
} as const;

export const SESSION_ERROR_DEF: Record<SessionErrorCode, ErrorDefinitions> = {
  SESSION_UNAUTHORIZED: {
    code: "SESSION_UNAUTHORIZED",
    status: 401,
    message: "Your session is invalid or has expired. Please log in again.",
  },
};

export type SessionErrorCode = keyof typeof SESSION_ERROR_CODES;
