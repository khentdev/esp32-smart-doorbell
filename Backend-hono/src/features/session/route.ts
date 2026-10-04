import { Hono } from "hono";

import authenticate from "../../middleware/authenticate.js";
import { getSessionController, logoutUserController } from "./controller.js";

const sessionRoutes = new Hono();
sessionRoutes.get("/me", authenticate, getSessionController);
sessionRoutes.delete("/logout", authenticate, logoutUserController);
export default sessionRoutes;
