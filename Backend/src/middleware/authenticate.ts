import type { Context, Next } from "hono";
import { AppError } from '../errors/appError.js';
import logger from '../infra/logger.js';
import { getNormalCookie, getSessionCookie } from '../lib/cookies.js';
import { compareHashes } from '../lib/hash.js';
import { verifyTokenOrThrow } from '../lib/jwt/tokens.js';
import { isValidDeviceFingerprint } from '../utils/validation.js';

import type { AppContext } from "../types/context.js";

async function authenticate(c: Context<AppContext>, next: Next) {

    const sessionCookie = await getSessionCookie(c)
    const csrfTokenFromHeader = c.req.header("X-CSRF-Token")
    const csrfTokenFromCookie = getNormalCookie(c, "csrfToken")
    const deviceId = c.req.header("X-Fingerprint")

    const Unauthorized = (reason: string, field: string): AppError => {
        logger.warn({ reason }, "Session Validation Failed.")
        return new AppError("SESSION_UNAUTHORIZED", { field })
    };

    if (!sessionCookie)
        throw Unauthorized("No session cookie present.", "authenticate_session_cookie")


    if (!csrfTokenFromHeader)
        throw Unauthorized("No CSRF token in request header.", "authenticate_csrf_header")


    if (!csrfTokenFromCookie)
        throw Unauthorized("No CSRF token in cookie.", "authenticate_csrf_cookie")


    if (csrfTokenFromHeader !== csrfTokenFromCookie)
        throw Unauthorized("CSRF token mismatch. Possible CSRF attack.", "authenticate_csrf_token")

    if (!isValidDeviceFingerprint(deviceId)) throw new AppError("INVALID_DEVICE_ID", { field: "authenticate_session" })

    const payload = await verifyTokenOrThrow(sessionCookie)

    if (!compareHashes(deviceId!, payload.deviceHash))
        throw Unauthorized("Fingerprint mismatch", "authenticate_device_id")

    c.set("authenticatedUserTokenPayload", payload)
    await next()
}

export default authenticate