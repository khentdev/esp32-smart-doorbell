import { getLogger } from "@logtape/logtape";
import type { Context, Next } from "hono";
import { AppError } from "../errors/appError.js";

import { getSessionCookie } from "../lib/cookies.js";
import { compareHashes } from "../lib/hash.js";
import { verifyTokenOrThrow } from "../lib/jwt/tokens.js";

import type { AppContext } from "../types/context.js";
import { deviceFingerprintSchema } from "../utils/validation.js";

/**
 * Auth for `GET /door/stream`. `EventSource` cannot send custom headers, so the browser
 * fingerprint arrives as a query param and there is no CSRF check (read-only GET).
 * Never log the query string or the fingerprint value (API doc §6.7).
 */
async function authenticateSse(c: Context<AppContext>, next: Next) {
  const logger = getLogger("my-app");

  const sessionCookie = await getSessionCookie(c);
  const parsedFingerprint = deviceFingerprintSchema.safeParse(
    c.req.query("fingerprint"),
  );

  const Unauthorized = (reason: string, field: string): AppError => {
    logger.warn("SSE Session Validation Failed.", { reason });
    return new AppError("SESSION_UNAUTHORIZED", { field });
  };

  if (!sessionCookie)
    throw Unauthorized(
      "No session cookie present.",
      "authenticate_session_cookie",
    );

  if (!parsedFingerprint.success) {
    logger.warn("Invalid device fingerprint.", {
      issues: parsedFingerprint.error.issues,
    });
    throw new AppError("INVALID_DEVICE_ID", { field: "authenticate_session" });
  }

  const payload = await verifyTokenOrThrow(sessionCookie);

  if (!compareHashes(parsedFingerprint.data, payload.deviceHash))
    throw Unauthorized("Fingerprint mismatch", "authenticate_device_id");

  c.set("authenticatedUserTokenPayload", payload);
  await next();
}

export default authenticateSse;
