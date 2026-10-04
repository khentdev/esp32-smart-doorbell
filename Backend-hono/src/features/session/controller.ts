import type { Context } from "hono";
import {
  deleteAuthCookie,
  deleteNormalCookie,
  setNormalCookie,
  setSessionCookie,
} from "../../lib/cookies.js";
import { tokenExpiry } from "../../lib/jwt/tokens.js";
import type { AppContext } from "../../types/context.js";
import { getSessionService } from "./service.js";

export async function getSessionController(c: Context<AppContext>) {
  const payload = c.var.authenticatedUserTokenPayload;

  const res = await getSessionService(payload);
  if (res.tokens) {
    await setSessionCookie({
      c,
      token: res.tokens.sessionToken,
      maxAge: tokenExpiry().sessionTokenMaxAge,
    });
    setNormalCookie(
      c,
      "csrfToken",
      res.tokens.csrfToken,
      tokenExpiry().sessionTokenMaxAge,
    );
  }
  return c.json({ user: res.user }, 200);
}

export async function logoutUserController(c: Context) {
  deleteAuthCookie(c, "sid");
  deleteNormalCookie(c, "csrfToken");
  return c.json({ message: "Logged out successfully." }, 200);
}
