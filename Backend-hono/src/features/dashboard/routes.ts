import { Hono } from "hono";
import authenticate from "../../middleware/authenticate";
import { getDashboardSummaryController } from "./controller";

const dashboardRoutes = new Hono();

dashboardRoutes.get("/summary", authenticate, getDashboardSummaryController);

export default dashboardRoutes;
