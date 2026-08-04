import type { Context } from "hono";
import { AppError } from "../errors/appError.js";
import logger from "../infra/logger.js";

const stackLimit = (e: Error, limit = 6) =>
    e.stack
        ?.split("\n")
        .map((line) => line.trim())
        .slice(0, limit)
        .join("\n");

const errorLogger = (err: Error, c: Context) => {
    logger.error({
        path: c.req.path,
        method: c.req.method,
        error: {
            name: err.name,
            code: (err as AppError).code ?? "SERVER_ERROR",
            message: err.message,
            ...(err?.cause ? { cause: err.cause } : {}),
            stack: stackLimit(err),
        }
    })
}

export const globalErrorHandler = (err: Error, c: Context) => {
    errorLogger(err, c)
    if (err instanceof AppError)
        return c.json({
            error: {
                message: err.message,
                code: err.code,
                field: err.field,
                data: err.data
            }
        }, err.status)
    return c.json({ error: { message: "Something went wrong on our end. Please try again later.", code: "SERVER_ERROR" } }, 500)
}
