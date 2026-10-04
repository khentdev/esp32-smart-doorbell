import { getLogger } from "@logtape/logtape";
import type { TokenPayload } from "../../lib/jwt";
import { generateSessionTokens } from "../../lib/jwt/tokens";
import { db } from "../../prisma/db";
import { AppError } from "../../errors/appError";

export async function getSessionService(payload: TokenPayload) {
  const logger = getLogger("my-app");

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - nowSeconds;
  const oneHour = 60 * 60;

  let tokens: Awaited<ReturnType<typeof generateSessionTokens>> | null = null;
  if (expiresIn < oneHour) {
    logger.info("Token nearing expiry. Starting rotation.", {
      userId: payload.sub,
      expiresIn,
    });

    try {
      tokens = await generateSessionTokens({
        sub: payload.sub,
        deviceHash: payload.deviceHash,
      });
      logger.info("JWT rotated successfully.", { userId: payload.sub });
    } finally {
    }
  }

  const user = await db.orm.public.User.select("username").first({
    id: payload.sub,
  });
  if (!user)
    throw new AppError("SESSION_UNAUTHORIZED", { field: "session_user" });

  return { user, tokens };
}
