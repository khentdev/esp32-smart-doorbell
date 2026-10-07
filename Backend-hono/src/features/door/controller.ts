import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import { manualDoorUnlockService } from "./service";
import type { ManualDoorUnlockResponse, ManualDoorUnlockInput } from "./types";

export async function manualDoorUnlockController(c: Context<AppContext>) {
  const { deviceId } = await c.req.json<ManualDoorUnlockInput>();
  await manualDoorUnlockService(deviceId);
  return c.json<ManualDoorUnlockResponse>({ status: "UNLOCK_REQUESTED" },202);
}
