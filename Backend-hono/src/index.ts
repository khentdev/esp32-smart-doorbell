import { serve } from "@hono/node-server";
import { getLogger } from "@logtape/logtape";
import createHonoApp from "./createHonoApp";
import "./infra/logger";

const app = createHonoApp();
const logger = getLogger("my-app");

const rawPort = (Bun.env.PORT ?? "").trim();
const parsedPort = rawPort.length > 0 ? Number(rawPort) : Number.NaN;
const port =
  Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535
    ? parsedPort
    : 3000;
serve({
  fetch: app.fetch,
  port,
});
logger.info(`Server running at http://localhost:${port}`);
