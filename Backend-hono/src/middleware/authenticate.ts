import { getLogger } from "@logtape/logtape";
import type { Context, Next } from "hono";
import { AppError } from "../errors/appError.js";

import { getNormalCookie, getSessionCookie } from "../lib/cookies.js";
import { compareHashes } from "../lib/hash.js";
import { verifyTokenOrThrow } from "../lib/jwt/tokens.js";

import type { AppContext } from "../types/context.js";
import { deviceFingerprintSchema } from "../utils/validation.js";

async function authenticate(c: Context<AppContext>, next: Next) {
  const logger = getLogger("my-app");

  const sessionCookie = await getSessionCookie(c);
  const csrfTokenFromHeader = c.req.header("X-CSRF-Token");
  const csrfTokenFromCookie = getNormalCookie(c, "csrfToken");
  const parsedFingerprint = deviceFingerprintSchema.safeParse(
    c.req.header("X-Fingerprint"),
  );

  const Unauthorized = (reason: string, field: string): AppError => {
    logger.warn("Session Validation Failed.", { reason });
    return new AppError("SESSION_UNAUTHORIZED", { field });
  };

  if (!sessionCookie)
    throw Unauthorized(
      "No session cookie present.",
      "authenticate_session_cookie",
    );

  if (!csrfTokenFromHeader)
    throw Unauthorized(
      "No CSRF token in request header.",
      "authenticate_csrf_header",
    );

  if (!csrfTokenFromCookie)
    throw Unauthorized("No CSRF token in cookie.", "authenticate_csrf_cookie");

  if (csrfTokenFromHeader !== csrfTokenFromCookie)
    throw Unauthorized(
      "CSRF token mismatch. Possible CSRF attack.",
      "authenticate_csrf_token",
    );

  if (!parsedFingerprint.success) {
    logger.warn("Invalid device fingerprint.", {
      issues: parsedFingerprint.error.issues,
    });
    throw new AppError("INVALID_DEVICE_ID", { field: "authenticate_session" });
  }
  const deviceId = parsedFingerprint.data;

  const payload = await verifyTokenOrThrow(sessionCookie);

  if (!compareHashes(deviceId, payload.deviceHash))
    throw Unauthorized("Fingerprint mismatch", "authenticate_device_id");

  c.set("authenticatedUserTokenPayload", payload);
  await next();
}

export default authenticate;
