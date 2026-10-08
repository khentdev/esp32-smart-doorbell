import type { DeviceId } from "../../config/devices";
import { db } from "../../prisma/db";

export async function manualDoorUnlock(deviceId: DeviceId) {
  const pendingUnlockAt = new Date().toISOString();
  await db.orm.public.DeviceCommand.upsert({
    create: { deviceId, pendingUnlockAt },
    update: { pendingUnlockAt },
  });
}

export async function consumePendingUnlock(deviceId: DeviceId, cutoff: string) {
  const plan = db.sql.public.DeviceCommand.update({ pendingUnlockAt: null })
    .where((f, fns) =>
      fns.and(fns.eq(f.deviceId, deviceId), fns.gt(f.pendingUnlockAt, cutoff)),
    )
    .returning("deviceId")
    .build();

  const rows = await db.runtime().query(plan);
  return rows.length > 0;
}