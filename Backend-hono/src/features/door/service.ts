import { getLogger } from "@logtape/logtape";
import { isKnownDevice, type DeviceId } from "../../config/devices";
import { env } from "../../config/env";
import { AppError } from "../../errors/appError";
import { consumePendingUnlock, manualDoorUnlock } from "./data";
import type { PollDeviceCommandResponse } from "./types";

export async function manualDoorUnlockService(deviceId: string) {
  const logger = getLogger();
  if (!isKnownDevice(deviceId)) {
    logger.warn("Unknown device.", { deviceId });
    throw new AppError("UNKNOWN_DEVICE_ID");
  }

  try {
    await manualDoorUnlock(deviceId);
  } catch (err) {
    throw new AppError("DOOR_UNLOCK_SERVER_ERROR");
  }
}

export async function pollDeviceCommandService(
  deviceId: string,
): Promise<PollDeviceCommandResponse> {
  const logger = getLogger();
  if (!isKnownDevice(deviceId)) {
    logger.warn("Unknown device.", { deviceId });
    throw new AppError("UNKNOWN_DEVICE_ID");
  }

  const ttlMs = Number(env.UNLOCK_COMMAND_TTL_SECONDS) * 1000;
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  try {
    const consumed = await consumePendingUnlock(deviceId, cutoff);
    return { command: consumed ? "UNLOCK" : null };
  } catch (err) {
    throw new AppError("POLL_DEVICE_ERROR");
  }
}
