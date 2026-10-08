import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import { manualDoorUnlockService, pollDeviceCommandService } from "./service";
import type {
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
