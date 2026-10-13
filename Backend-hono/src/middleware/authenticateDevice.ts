import { getLogger } from "@logtape/logtape";
import type { Context, Next } from "hono";
import { env } from "../config/env.js";
import { AppError } from "../errors/appError.js";
import { safeEqual } from "../lib/hash.js";

async function authenticateDevice(c: Context, next: Next) {
  const logger = getLogger("my-app");
  const providedKey = c.req.header("X-API-Key") ?? "";

  if (!safeEqual(providedKey, env.DEVICE_API_KEY)) {
    logger.warn("Device API key rejected.", { path: c.req.path });
    throw new AppError("DEVICE_UNAUTHORIZED", { field: "authenticate_device" });
  }

  await next();
}

export default authenticateDevice;
