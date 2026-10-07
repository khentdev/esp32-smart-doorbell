import { getLogger } from "@logtape/logtape";
import { isKnownDevice, type DeviceId } from "../../config/devices";
import { AppError } from "../../errors/appError";
import { manualDoorUnlock } from "./data";

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
