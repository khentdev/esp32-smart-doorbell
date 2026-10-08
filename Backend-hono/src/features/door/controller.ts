import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import {
  manualDoorUnlockService,
  pollDeviceCommandService,
  reportAccessService,
} from "./service";
import type {
  AccessEventDTO,
  ManualDoorUnlockInput,
  ManualDoorUnlockResponse,
  PollDeviceCommandResponse,
} from "./types";

export async function manualDoorUnlockController(c: Context<AppContext>) {
  const { deviceId } = await c.req.json<ManualDoorUnlockInput>();
  await manualDoorUnlockService(deviceId);
  return c.json<ManualDoorUnlockResponse>({ status: "UNLOCK_REQUESTED" },202);
}

export async function pollDeviceCommandController(c: Context) {
  const deviceId = c.req.query("deviceId") ?? "";
  const result = await pollDeviceCommandService(deviceId);
  return c.json<PollDeviceCommandResponse>(result, 200);
}

export async function reportAccessController(c: Context) {
  const body = await c.req.json();
  const event = await reportAccessService(body);
  return c.json<AccessEventDTO>(event, 201);
}
