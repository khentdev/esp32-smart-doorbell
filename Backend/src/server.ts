import { serve } from "@hono/node-server";
import { env } from "./configs/env.js";
import createHonoApp from "./createHonoApp.js";
import { handleGracefulShutdown } from "./infra/appGracefulShutdown.js";
import logger from "./infra/logger.js";

const app = createHonoApp()
handleGracefulShutdown()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port, env: env.NODE_ENV }, `Server started at http://localhost:${info.port}`)
})