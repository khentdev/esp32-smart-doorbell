import type { ErrorDefinitions } from "../../errors";

export const DASHBOARD_ERROR_CODES = {
  DASHBOARD_SUMMARY_ERROR: "DASHBOARD_SUMMARY_ERROR",
} as const;

export const DASHBOARD_ERROR_DEFINITIONS: Record<ErrorCodes, ErrorDefinitions> = {
  DASHBOARD_SUMMARY_ERROR: {
    code: "DASHBOARD_SUMMARY_ERROR",
    status: 500,
    message: "Unable to load the dashboard summary. Please try again later.",
  },
};

export type ErrorCodes =
  (typeof DASHBOARD_ERROR_CODES)[keyof typeof DASHBOARD_ERROR_CODES];
