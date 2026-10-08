import type { ErrorDefinitions } from "../../errors";

export const DOOR_ERROR_CODES = {
  DOOR_UNLOCK_SERVER_ERROR: "DOOR_UNLOCK_SERVER_ERROR",
  UNKNOWN_DEVICE_ID: "UNKNOWN_DEVICE_ID",
  DEVICE_UNAUTHORIZED: "DEVICE_UNAUTHORIZED",
  POLL_DEVICE_ERROR: "POLL_DEVICE_ERROR",
  ACCESS_EVENT_SERVER_ERROR: "ACCESS_EVENT_SERVER_ERROR",
} as const;

export const DOOR_ERROR_DEFINITIONS: Record<ErrorCodes, ErrorDefinitions> = {
  DOOR_UNLOCK_SERVER_ERROR: {
    code: "DOOR_UNLOCK_SERVER_ERROR",
    status: 500,
    message: "Unable to request manual door unlock. Please try again later.",
  },
  UNKNOWN_DEVICE_ID: {
    code: "UNKNOWN_DEVICE_ID",
    status: 400,
    message: "Unknown device id.",
  },
  DEVICE_UNAUTHORIZED: {
    code: "DEVICE_UNAUTHORIZED",
    status: 401,
    message: "Invalid or missing device API key.",
  },
  POLL_DEVICE_ERROR: {
    code: "POLL_DEVICE_ERROR",
    status: 500,
    message: "Unable to consume pending unlock. Please try again later.",
  },
  ACCESS_EVENT_SERVER_ERROR: {
    code: "ACCESS_EVENT_SERVER_ERROR",
    status: 500,
    message: "Unable to record the access event. Please try again later.",
  },
};

export type ErrorCodes =
  (typeof DOOR_ERROR_CODES)[keyof typeof DOOR_ERROR_CODES];
