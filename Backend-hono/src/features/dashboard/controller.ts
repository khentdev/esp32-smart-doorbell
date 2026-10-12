import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import { getDashboardSummaryService } from "./service";
import type { DashboardSummaryResponse } from "./types";

export async function getDashboardSummaryController(c: Context<AppContext>) {
  const summary = await getDashboardSummaryService();
  return c.json<DashboardSummaryResponse>(summary, 200);
}
