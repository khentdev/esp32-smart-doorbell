import { getLogger } from "@logtape/logtape";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { AppError } from "../errors/appError";
import { FEATURE_ERROR_DEFINITIONS } from "../errors";

/**
 * Every error response uses one envelope so the frontend only reads `error.code`:
 * { error: { code, message, field?, data?, issues? } }
 * - AppError (auth/session): code/message/field/data from the error itself.
 * - ZodError (input validation): code VALIDATION_ERROR, issues: [{ path, message }].
 */
const logError = (err: Error, c: Context, status: number) => {
  const logger = getLogger("my-app");
  const props = { method: c.req.method, path: c.req.path, status, error: err };
  // Expected client errors (bad password, expired token, ...) are not server faults.
  if (status < 500) logger.warn("{method} {path} -> {status}: {error}", props);
  else logger.error("{method} {path} -> {status}: {error}", props);
};

export const globalErrorHandler = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    logError(err, c, err.status);
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          field: err.field,
          data: err.data,
        },
      },
      err.status,
    );
  }

  if (err instanceof ZodError) {
    logError(err, c, 400);
    const { code, message } = FEATURE_ERROR_DEFINITIONS.VALIDATION_ERROR;
    return c.json(
      {
        error: {
          code,
          message,
          issues: err.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      400,
    );
  }

  if (err instanceof SyntaxError) {
    logError(err, c, 400);
    const { code, message } = FEATURE_ERROR_DEFINITIONS.INVALID_BODY;
    return c.json({ error: { code, message } }, 400);
  }

  if (err instanceof HTTPException) {
    logError(err, c, err.status);
    return err.getResponse();
  }

  logError(err, c, 500);
  const { code, message } = FEATURE_ERROR_DEFINITIONS.SERVER_ERROR;
  return c.json({ error: { code, message } }, 500);
};
