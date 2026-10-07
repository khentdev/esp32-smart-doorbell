import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AUTH_ERROR_CODES, AUTH_ERROR_DEF } from "../features/auth/errors";
import {
  SESSION_ERROR_CODES,
  SESSION_ERROR_DEF,
} from "../features/session/errors";
import { DOOR_ERROR_CODES, DOOR_ERROR_DEFINITIONS } from "../features/door/errors";

export type ErrorDefinitions = {
  code: ErrorCodes;
  status: ContentfulStatusCode;
  message: string;
};

export type AppErrorOptions = {
  cause?: string;
  field?: string;
  data?: Record<string, any>;
  messageOverride?: string;
};

export const FEATURE_ERROR_CODES = {
  ...AUTH_ERROR_CODES,
  ...SESSION_ERROR_CODES,
  ...DOOR_ERROR_CODES,
  INVALID_DEVICE_ID: "INVALID_DEVICE_ID",
  SERVER_ERROR: "SERVER_ERROR",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  API_KEY_INVALID: "API_KEY_INVALID",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  INVALID_BODY: "INVALID_BODY",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export const FEATURE_ERROR_DEFINITIONS: Record<ErrorCodes, ErrorDefinitions> = {
  ...AUTH_ERROR_DEF,
  ...SESSION_ERROR_DEF,
  ...DOOR_ERROR_DEFINITIONS,
  INVALID_DEVICE_ID: {
    code: "INVALID_DEVICE_ID",
    status: 400,
    message:
      "Unable to verify your device. Please refresh the page and try again.",
  },
  TOKEN_INVALID: {
    code: "TOKEN_INVALID",
    status: 401,
    message: "Invalid or malformed token.",
  },
  TOKEN_EXPIRED: {
    code: "TOKEN_EXPIRED",
    status: 401,
    message: "Token has expired.",
  },
  SERVER_ERROR: {
    code: "SERVER_ERROR",
    status: 500,
    message: "Something went wrong on our end. Please try again later.",
  },
  API_KEY_INVALID: {
    code: "API_KEY_INVALID",
    status: 401,
    message: "Invalid or missing API key.",
  },
  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    status: 404,
    message: "User not found.",
  },
  INVALID_BODY: {
    code: "INVALID_BODY",
    status: 400,
    message: "Request body is missing or is not valid JSON.",
  },
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    status: 400,
    message: "One or more fields are invalid.",
  },
};

export type ErrorCodes =
  (typeof FEATURE_ERROR_CODES)[keyof typeof FEATURE_ERROR_CODES];
