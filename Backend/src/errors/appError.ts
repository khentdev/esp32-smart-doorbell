import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppErrorOptions, ErrorCodes } from "./index.js";
import { FEATURE_ERROR_DEFINITIONS } from "./index.js";

export class AppError extends Error {

    status: ContentfulStatusCode
    code: ErrorCodes
    field?: string
    data?: Record<string, any>

    constructor(code: ErrorCodes, options: AppErrorOptions = {}) {
        const message = options.messageOverride ?? FEATURE_ERROR_DEFINITIONS[code].message
        super(message, { cause: options.cause })

        this.code = FEATURE_ERROR_DEFINITIONS[code].code
        this.status = FEATURE_ERROR_DEFINITIONS[code].status
        this.field = options.field
        this.name = "AppError"
    }
}