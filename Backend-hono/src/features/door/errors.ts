import type { ErrorDefinitions } from "../../errors";

export const DOOR_ERROR_CODES = {
  DOOR_UNLOCK_SERVER_ERROR: "DOOR_UNLOCK_SERVER_ERROR",
  UNKNOWN_DEVICE_ID: "UNKNOWN_DEVICE_ID",
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
};

export type ErrorCodes =
  (typeof DOOR_ERROR_CODES)[keyof typeof DOOR_ERROR_CODES];
