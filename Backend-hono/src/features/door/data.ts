import type { DeviceId } from "../../config/devices";
import { db } from "../../prisma/db";

export async function manualDoorUnlock(deviceId: DeviceId) {
  const pendingUnlockAt = new Date().toISOString();
  await db.orm.public.DeviceCommand.upsert({
    create: { deviceId, pendingUnlockAt },
    update: { pendingUnlockAt },
  });
}
