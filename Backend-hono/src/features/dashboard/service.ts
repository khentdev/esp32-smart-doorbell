import { getLogger } from "@logtape/logtape";
import { DEVICE_LABELS, isKnownDevice } from "../../config/devices";
import { AppError } from "../../errors/appError";
import type { AccessEventDTO } from "../door/types";
import { countAccessEventsByOutcome, findRecentAccessEvents } from "./data";
import type { DashboardSummaryResponse } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getUtcDayWindow(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export async function getDashboardSummaryService(
  now: Date = new Date(),
): Promise<DashboardSummaryResponse> {
  const logger = getLogger();
  const { start, end } = getUtcDayWindow(now);

  try {
    const [counts, history] = await Promise.all([
      countAccessEventsByOutcome(start, end),
      findRecentAccessEvents(),
    ]);

    const totalFor = (outcome: string) =>
      counts.find((row) => row.outcome === outcome)?.total ?? 0;

    const recentHistory: AccessEventDTO[] = history.map((row) => ({
      id: row.id,
      deviceId: row.deviceId,
      deviceLabel: isKnownDevice(row.deviceId)
        ? DEVICE_LABELS[row.deviceId]
        : row.deviceId,
      outcome: row.outcome,
      fingerprintSlot: row.fingerprintSlot ?? null,
      fingerprintName: row.fingerprintName ?? null,
      timestamp: new Date(row.timestamp).toISOString(),
    }));

    return {
      accessGrantedToday: totalFor("GRANTED") + totalFor("ADMIN_UNLOCK"),
      accessDeniedToday: totalFor("DENIED"),
      lastEventAt: recentHistory[0]?.timestamp ?? null,
      recentHistory,
    };
  } catch (err) {
    logger.error("Failed to load dashboard summary.", { err });
    throw new AppError("DASHBOARD_SUMMARY_ERROR");
  }
}
