import type { Hono } from "hono";
import authRoutes from "../features/auth/route";
import sessionRoutes from "../features/session/route";

export default function registerAppRoutes(app: Hono) {
  app.get("/", (c) => c.redirect("/healthz"));
  app.get("/healthz", (c) => c.json({ status: "Server status is good." }, 200));
  app.route("/auth", authRoutes);
  app.route("/session", sessionRoutes);
}
