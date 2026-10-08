import type { DeviceId } from "../../config/devices";
import { db } from "../../prisma/db";
import type { AccessOutcome } from "./types";

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

export async function createAccessEvent(input: {
  deviceId: DeviceId;
  outcome: AccessOutcome;
  fingerprintSlot: number | null;
}) {
  return db.orm.public.AccessEvent.create(input);
}
