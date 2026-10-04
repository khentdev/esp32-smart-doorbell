import type { ContentfulStatusCode } from "hono/utils/http-status";
import { FEATURE_ERROR_DEFINITIONS, type AppErrorOptions, type ErrorCodes } from ".";

export class AppError extends Error {
  status: ContentfulStatusCode;
  code: ErrorCodes;
  field?: string;
  data?: Record<string, any>;

  constructor(code: ErrorCodes, options: AppErrorOptions = {}) {
    const message =
      options.messageOverride ?? FEATURE_ERROR_DEFINITIONS[code].message;
    super(message, { cause: options.cause });

    this.code = FEATURE_ERROR_DEFINITIONS[code].code;
    this.status = FEATURE_ERROR_DEFINITIONS[code].status;
    this.field = options.field;
    this.data = options.data;
    this.name = "AppError";
  }
}
