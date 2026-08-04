
import { Hono } from "hono";
/**
 * e.g import authRoutes from "../auth/routes.js"
 */
export function registerAppRoutes(app: Hono) {
    app.get("/", (c) => c.redirect("/health-check"))
    app.get("/health-check", (c) => c.json({ status: "Server status is good." }, 200))
}

    