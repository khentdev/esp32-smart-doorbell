import type { Context } from "hono";
import { loginService } from "./service";
import type { AppContext } from "../../types/context";
import type { LoginInputVariables, LoginResponse } from "./types";
import { setCsrfTokenCookie, setSessionCookie } from "../../lib/cookies";
import { tokenExpiry } from "../../lib/jwt/tokens";

export async function loginController(
  c: Context<AppContext<LoginInputVariables>>,
) {
  const { username, password, deviceId } = c.var.LoginInput;
  const { sessionToken, csrfToken, user } = await loginService({
    username,
    password,
    deviceId,
  });

  await setSessionCookie({
    c,
    token: sessionToken,
    maxAge: tokenExpiry().sessionTokenMaxAge,
  });
  setCsrfTokenCookie({
    c,
    token: csrfToken,
    maxAge: tokenExpiry().csrfTokenMaxAge,
  });

  return c.json<LoginResponse>(
    {
      data: { user },
      message: "Logged in successfully",
    },
    200,
  );
}
