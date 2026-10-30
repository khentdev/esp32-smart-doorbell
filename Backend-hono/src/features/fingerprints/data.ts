import type { DeviceId } from "../../config/devices";
import type { Models } from "../../prisma/contract.d.ts";
import { db } from "../../prisma/db";
import type { FingerprintJobError, FingerprintJobStep, FingerprintJobType } from "./types";

export type FingerprintRow = Models.public_Fingerprint;
export type FingerprintJobRow = Models.public_FingerprintJob;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findFingerprintsByDevice(deviceId: DeviceId) {
  return db.orm.public.Fingerprint.where({ deviceId })
    .orderBy([(f) => f.createdAt.asc(), (f) => f.id.asc()])
    .all();
}

export async function findFingerprintById(id: string) {
  return db.orm.public.Fingerprint.first({ id });
}

export async function findFingerprintBySlot(deviceId: DeviceId, slot: number) {
  return db.orm.public.Fingerprint.where({ deviceId, slot }).first();
}

export async function renameFingerprint(id: string, name: string) {
  const plan = db.sql.public.Fingerprint.update({ name, updatedAt: new Date().toISOString() })
    .where((f, fns) => fns.eq(f.id, id))
    .returning("id", "deviceId", "name", "slot", "createdAt", "updatedAt")
    .build();
  const [row] = await db.runtime().query(plan);
  return row ?? null;
}

export async function findActiveJob(deviceId: DeviceId) {
  return db.orm.public.FingerprintJob.where({ deviceId })
    .where((j) => j.status.in(["PENDING", "SENT"]))
    .first();
}

export async function findJob(id: string, deviceId: DeviceId) {
  return db.orm.public.FingerprintJob.where({ id, deviceId }).first();
}

export async function createJob(input: {
  deviceId: DeviceId;
  type: FingerprintJobType;
  slot: number;
  name: string;
  fingerprintId: string | null;
}) {
  return db.orm.public.FingerprintJob.create({
    ...input,
    status: "PENDING",
    step: null,
    error: null,
    sentAt: null,
  });
}

const JOB_COLUMNS = [
  "id",
  "deviceId",
  "type",
  "slot",
  "name",
  "fingerprintId",
  "status",
  "step",
  "error",
  "sentAt",
  "createdAt",
  "updatedAt",
] as const;

/**
 * PENDING jobs created before `pendingCutoff` become EXPIRED (the device never polled);
 * SENT jobs delivered before `sentCutoff` become FAILED / DEVICE_TIMEOUT (it never reported back).
 * Returns every job that changed so the caller can broadcast them.
 */
export async function expireStaleJobs(deviceId: DeviceId, pendingCutoff: string, sentCutoff: string) {
  const now = new Date().toISOString();
  const expirePlan = db.sql.public.FingerprintJob.update({ status: "EXPIRED", updatedAt: now })
    .where((f, fns) =>
      fns.and(
        fns.eq(f.deviceId, deviceId),
        fns.eq(f.status, "PENDING"),
        fns.lte(f.createdAt, pendingCutoff),
      ),
    )
    .returning(...JOB_COLUMNS)
    .build();
  const timeoutPlan = db.sql.public.FingerprintJob.update({
    status: "FAILED",
    error: "DEVICE_TIMEOUT",
    updatedAt: now,
  })
    .where((f, fns) =>
      fns.and(fns.eq(f.deviceId, deviceId), fns.eq(f.status, "SENT"), fns.lte(f.sentAt, sentCutoff)),
    )
    .returning(...JOB_COLUMNS)
    .build();

  const expired = await db.runtime().query(expirePlan);
  const timedOut = await db.runtime().query(timeoutPlan);
  return [...expired, ...timedOut];
}

/**
 * Atomically hands the device its PENDING job (marks it SENT) so two overlapping polls can
 * never both receive it. Jobs older than `cutoff` are left for expireStaleJobs.
 */
export async function claimPendingJob(deviceId: DeviceId, cutoff: string) {
  const now = new Date().toISOString();
  const plan = db.sql.public.FingerprintJob.update({ status: "SENT", sentAt: now, updatedAt: now })
    .where((f, fns) =>
      fns.and(fns.eq(f.deviceId, deviceId), fns.eq(f.status, "PENDING"), fns.gt(f.createdAt, cutoff)),
    )
    .returning(...JOB_COLUMNS)
    .build();
  const [row] = await db.runtime().query(plan);
  return row ?? null;
}

type JobPatch = {
  status?: "SUCCEEDED" | "FAILED";
  step?: FingerprintJobStep;
  error?: Exclude<FingerprintJobError, "DEVICE_TIMEOUT">;
};

/** Updates a job only while it is still SENT. Returns null if it isn't (finished, expired, timed out). */
export async function updateSentJob(
  id: string,
  deviceId: DeviceId,
  patch: JobPatch,
  runner: Pick<Tx, "sql" | "query"> = { sql: db.sql, query: (plan) => db.runtime().query(plan) },
) {
  const plan = runner.sql.public.FingerprintJob.update({ ...patch, updatedAt: new Date().toISOString() })
    .where((f, fns) =>
      fns.and(fns.eq(f.id, id), fns.eq(f.deviceId, deviceId), fns.eq(f.status, "SENT")),
    )
    .returning(...JOB_COLUMNS)
    .build();
  const [row] = await runner.query(plan);
  return row ?? null;
}

/** Marks the job SUCCEEDED and applies its effect (add or remove the person) in one transaction. */
export async function completeJob(id: string, deviceId: DeviceId) {
  return db.transaction(async (tx) => {
    const job = await updateSentJob(id, deviceId, { status: "SUCCEEDED" }, tx);
    if (!job) return null;

    let fingerprint: FingerprintRow | null = null;
    if (job.type === "ENROLL") {
      fingerprint = await tx.orm.public.Fingerprint.create({
        deviceId: job.deviceId,
        slot: job.slot,
        name: job.name,
      });
    } else if (job.fingerprintId) {
      await tx.orm.public.Fingerprint.where({ id: job.fingerprintId }).delete();
    }
    return { job, fingerprint };
  });
}
