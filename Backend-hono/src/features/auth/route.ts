import { Hono } from "hono";
import { validateLoginInput } from "./middleware.js";
import { loginController } from "./controller.js";

const authRoutes = new Hono();
authRoutes.post("/login", validateLoginInput, loginController);

export default authRoutes;
