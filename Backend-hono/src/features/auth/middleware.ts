import type { Context, Next } from "hono";
import { z } from "zod";

import { AppError } from "../../errors/appError.js";
import type { AppContext } from "../../types/context.js";
import { deviceFingerprintSchema } from "../../utils/validation.js";
import type { LoginInputRequestBody, LoginInputVariables } from "./types.js";


const nonBlankString = z.string().regex(/\S/);

const loginInputSchema = z.object({
  username: nonBlankString,
  password: nonBlankString,
  deviceId: deviceFingerprintSchema,
});

const LOGIN_ERRORS = {
  username: "INVALID_USERNAME",
  password: "INVALID_PASSWORD",
  deviceId: "INVALID_DEVICE_ID",
} as const;

export async function validateLoginInput(
  c: Context<AppContext<LoginInputVariables>>,
  next: Next,
) {
  const { username, password } = await c.req.json<LoginInputRequestBody>();

  const parsed = loginInputSchema.safeParse({
    username,
    password,
    deviceId: c.req.header("X-Fingerprint"),
  });

  if (!parsed.success) {
    const key = parsed.error.issues[0].path[0] as keyof typeof LOGIN_ERRORS;
    throw new AppError(LOGIN_ERRORS[key]);
  }

  c.set("LoginInput", parsed.data);
  await next();
}
