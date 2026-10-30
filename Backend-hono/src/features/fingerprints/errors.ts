import type { ErrorDefinitions } from "../../errors";

export const FINGERPRINT_ERROR_CODES = {
  FINGERPRINT_NOT_FOUND: "FINGERPRINT_NOT_FOUND",
  FINGERPRINT_NAME_TAKEN: "FINGERPRINT_NAME_TAKEN",
  FINGERPRINT_SLOTS_FULL: "FINGERPRINT_SLOTS_FULL",
  FINGERPRINT_JOB_IN_PROGRESS: "FINGERPRINT_JOB_IN_PROGRESS",
  FINGERPRINT_JOB_NOT_FOUND: "FINGERPRINT_JOB_NOT_FOUND",
  FINGERPRINT_JOB_NOT_ACTIVE: "FINGERPRINT_JOB_NOT_ACTIVE",
  FINGERPRINT_SERVER_ERROR: "FINGERPRINT_SERVER_ERROR",
} as const;

export const FINGERPRINT_ERROR_DEFINITIONS: Record<ErrorCodes, ErrorDefinitions> = {
  FINGERPRINT_NOT_FOUND: {
    code: "FINGERPRINT_NOT_FOUND",
    status: 404,
    message: "That fingerprint no longer exists.",
  },
  FINGERPRINT_NAME_TAKEN: {
    code: "FINGERPRINT_NAME_TAKEN",
    status: 409,
    message: "Someone with that name is already enrolled.",
  },
  FINGERPRINT_SLOTS_FULL: {
    code: "FINGERPRINT_SLOTS_FULL",
    status: 409,
    message: "The fingerprint sensor is full. Remove someone first.",
  },
  FINGERPRINT_JOB_IN_PROGRESS: {
    code: "FINGERPRINT_JOB_IN_PROGRESS",
    status: 409,
    message: "Another fingerprint task is in progress. Please wait for it to finish.",
  },
  FINGERPRINT_JOB_NOT_FOUND: {
    code: "FINGERPRINT_JOB_NOT_FOUND",
    status: 404,
    message: "Unknown fingerprint job.",
  },
  FINGERPRINT_JOB_NOT_ACTIVE: {
    code: "FINGERPRINT_JOB_NOT_ACTIVE",
    status: 409,
    message: "This fingerprint job is no longer running.",
  },
  FINGERPRINT_SERVER_ERROR: {
    code: "FINGERPRINT_SERVER_ERROR",
    status: 500,
    message: "Unable to update fingerprints. Please try again later.",
  },
};

export type ErrorCodes =
  (typeof FINGERPRINT_ERROR_CODES)[keyof typeof FINGERPRINT_ERROR_CODES];
