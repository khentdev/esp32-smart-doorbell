import { getLogger } from "@logtape/logtape";
import { db } from "../../prisma/db";
import type { LoginInput } from "./types";
import { AppError } from "../../errors/appError";
import { generateSessionTokens } from "../../lib/jwt/tokens";
import { hashData } from "../../lib/hash";

export async function loginService({
  username,
  password,
  deviceId,
}: LoginInput) {
  const logger = getLogger("my-app");

  const user = await db.orm.public.User.select(
    "id",
    "username",
    "hashedPassword",
  ).first({ username });
  if (!user) {
    logger.warn("User not found.", { username });
    throw new AppError("INVALID_CREDENTIALS", { field: "username_password" });
  }
  const isPasswordMatched = await Bun.password.verify(
    password,
    user.hashedPassword,
  );
  if (!isPasswordMatched) {
    logger.warn("Invalid password", { username });
    throw new AppError("INVALID_CREDENTIALS", { field: "username_password" });
  }

  const { sessionToken, csrfToken } = await generateSessionTokens({
    sub: user.id,
    deviceHash: hashData(deviceId),
  });

  logger.info("Generating session tokens for this user.", { username });
  return {
    sessionToken,
    csrfToken,
    user: {
      username: user.username,
    },
  };
}
