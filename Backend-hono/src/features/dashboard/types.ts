import type { AccessEventDTO } from "../door/types";

export type DashboardSummaryResponse = {
  accessGrantedToday: number;
  accessDeniedToday: number;
  lastEventAt: string | null;
  recentHistory: AccessEventDTO[];
};
