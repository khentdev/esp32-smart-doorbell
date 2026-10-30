import { getLogger } from "@logtape/logtape";
import { DEVICE_LABELS, isKnownDevice } from "../../config/devices";
import { env } from "../../config/env";
import { AppError } from "../../errors/appError";
import { findFingerprintBySlot } from "../fingerprints/data";
import { claimFingerprintCommand } from "../fingerprints/service";
import { consumePendingUnlock, createAccessEvent, manualDoorUnlock } from "./data";
import { publishAccessEvent } from "./events";
import type { AccessEventDTO, PollDeviceCommandResponse } from "./types";
import { reportAccessSchema } from "./validation";

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
    // A pending unlock always wins; a fingerprint job waits for the next poll.
    if (await consumePendingUnlock(deviceId, cutoff)) return { command: "UNLOCK" };
    return (await claimFingerprintCommand(deviceId)) ?? { command: null };
  } catch (err) {
    logger.error("Failed to poll device command.", { err });
    throw new AppError("POLL_DEVICE_ERROR");
  }
}

export async function reportAccessService(body: unknown): Promise<AccessEventDTO> {
  const logger = getLogger();
  const input = reportAccessSchema.parse(body);
  const { deviceId } = input;
  if (!isKnownDevice(deviceId)) {
    logger.warn("Unknown device.", { deviceId });
    throw new AppError("UNKNOWN_DEVICE_ID");
  }

  let row;
  try {
    // Snapshot the person's current name so history survives a rename or delete.
    const fingerprintName =
      input.fingerprintSlot === null
        ? null
        : ((await findFingerprintBySlot(deviceId, input.fingerprintSlot))?.name ?? null);
    row = await createAccessEvent({
      deviceId,
      outcome: input.outcome,
      fingerprintSlot: input.fingerprintSlot,
      fingerprintName,
    });
  } catch (err) {
    throw new AppError("ACCESS_EVENT_SERVER_ERROR");
  }

  const event: AccessEventDTO = {
    id: row.id,
    deviceId,
    deviceLabel: DEVICE_LABELS[deviceId],
    outcome: row.outcome,
    fingerprintSlot: row.fingerprintSlot ?? null,
    fingerprintName: row.fingerprintName ?? null,
    timestamp: new Date(row.timestamp).toISOString(),
  };
  publishAccessEvent(event);
  return event;
}
