import { getLogger } from "@logtape/logtape";
import { type DeviceId, isKnownDevice } from "../../config/devices";
import { env } from "../../config/env";
import { AppError } from "../../errors/appError";
import { publishFingerprintEvent } from "../door/events";
import {
  type FingerprintJobRow,
  type FingerprintRow,
  claimPendingJob,
  completeJob,
  createJob,
  expireStaleJobs,
  findActiveJob,
  findFingerprintById,
  findFingerprintsByDevice,
  findJob,
  renameFingerprint,
  updateSentJob,
} from "./data";
import type {
  FingerprintCommand,
  FingerprintDTO,
  FingerprintJobDTO,
  FingerprintJobError,
  FingerprintJobStep,
  ListFingerprintsResponse,
} from "./types";
import {
  enrollFingerprintSchema,
  isUuid,
  renameFingerprintSchema,
  reportJobProgressSchema,
} from "./validation";

/** Sensor template slots. Slot 0 is left unused so a slot is always a positive number. */
export const MAX_SLOT = 127;

const iso = (value: string | number) => new Date(value).toISOString();

export const toFingerprintDTO = (row: FingerprintRow): FingerprintDTO => ({
  id: row.id,
  deviceId: row.deviceId,
  name: row.name,
  slot: row.slot,
  createdAt: iso(row.createdAt),
});

export const toJobDTO = (row: FingerprintJobRow): FingerprintJobDTO => ({
  id: row.id,
  deviceId: row.deviceId,
  type: row.type,
  status: row.status,
  step: (row.step as FingerprintJobStep | null) ?? null,
  error: (row.error as FingerprintJobError | null) ?? null,
  name: row.name,
  slot: row.slot,
  fingerprintId: row.fingerprintId ?? null,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

const broadcast = (job: FingerprintJobRow, fingerprint: FingerprintRow | null = null) =>
  publishFingerprintEvent({
    job: toJobDTO(job),
    fingerprint: fingerprint ? toFingerprintDTO(fingerprint) : null,
  });

/** Runs `fn`, turning any unexpected database failure into FINGERPRINT_SERVER_ERROR. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) throw err;
    getLogger().error("Fingerprint operation failed.", { err });
    throw new AppError("FINGERPRINT_SERVER_ERROR");
  }
}

function assertKnownDevice(deviceId: string): asserts deviceId is DeviceId {
  if (!isKnownDevice(deviceId)) {
    getLogger().warn("Unknown device.", { deviceId });
    throw new AppError("UNKNOWN_DEVICE_ID");
  }
}

/** Expiry is computed on read: no background timer. Every job that changes is broadcast. */
async function resolveStaleJobs(deviceId: DeviceId) {
  const now = Date.now();
  const pendingCutoff = iso(now - Number(env.UNLOCK_COMMAND_TTL_SECONDS) * 1000);
  const sentCutoff = iso(now - Number(env.FINGERPRINT_JOB_TIMEOUT_SECONDS) * 1000);
  for (const job of await expireStaleJobs(deviceId, pendingCutoff, sentCutoff)) broadcast(job);
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function assertNoActiveJob(deviceId: DeviceId) {
  await resolveStaleJobs(deviceId);
  if (await findActiveJob(deviceId)) throw new AppError("FINGERPRINT_JOB_IN_PROGRESS");
}

/** Creates the job, mapping a race on the one-active-job unique index to a 409. */
async function createJobOrConflict(input: Parameters<typeof createJob>[0]) {
  try {
    return await createJob(input);
  } catch (err) {
    if (await findActiveJob(input.deviceId)) throw new AppError("FINGERPRINT_JOB_IN_PROGRESS");
    throw err;
  }
}

export async function listFingerprintsService(deviceId: string): Promise<ListFingerprintsResponse> {
  assertKnownDevice(deviceId);
  return guard(async () => {
    await resolveStaleJobs(deviceId);
    const [fingerprints, activeJob] = await Promise.all([
      findFingerprintsByDevice(deviceId),
      findActiveJob(deviceId),
    ]);
    return {
      fingerprints: fingerprints.map(toFingerprintDTO),
      activeJob: activeJob ? toJobDTO(activeJob) : null,
    };
  });
}

export async function enrollFingerprintService(body: unknown): Promise<FingerprintJobDTO> {
  const { deviceId, name } = enrollFingerprintSchema.parse(body);
  assertKnownDevice(deviceId);

  return guard(async () => {
    await assertNoActiveJob(deviceId);

    const enrolled = await findFingerprintsByDevice(deviceId);
    if (enrolled.some((f) => sameName(f.name, name))) throw new AppError("FINGERPRINT_NAME_TAKEN");

    const used = new Set(enrolled.map((f) => f.slot));
    let slot = 1;
    while (used.has(slot)) slot++;
    if (slot > MAX_SLOT) throw new AppError("FINGERPRINT_SLOTS_FULL");

    const job = await createJobOrConflict({ deviceId, type: "ENROLL", slot, name, fingerprintId: null });
    broadcast(job);
    return toJobDTO(job);
  });
}

export async function renameFingerprintService(id: string, body: unknown): Promise<FingerprintDTO> {
  const { name } = renameFingerprintSchema.parse(body);
  if (!isUuid(id)) throw new AppError("FINGERPRINT_NOT_FOUND");

  return guard(async () => {
    const fingerprint = await findFingerprintById(id);
    if (!fingerprint) throw new AppError("FINGERPRINT_NOT_FOUND");

    const others = await findFingerprintsByDevice(fingerprint.deviceId as DeviceId);
    if (others.some((f) => f.id !== id && sameName(f.name, name))) {
      throw new AppError("FINGERPRINT_NAME_TAKEN");
    }

    const updated = await renameFingerprint(id, name);
    if (!updated) throw new AppError("FINGERPRINT_NOT_FOUND");
    return toFingerprintDTO(updated);
  });
}

export async function deleteFingerprintService(id: string): Promise<FingerprintJobDTO> {
  if (!isUuid(id)) throw new AppError("FINGERPRINT_NOT_FOUND");

  return guard(async () => {
    const fingerprint = await findFingerprintById(id);
    if (!fingerprint) throw new AppError("FINGERPRINT_NOT_FOUND");
    const deviceId = fingerprint.deviceId as DeviceId;

    await assertNoActiveJob(deviceId);

    const job = await createJobOrConflict({
      deviceId,
      type: "DELETE",
      slot: fingerprint.slot,
      name: fingerprint.name,
      fingerprintId: fingerprint.id,
    });
    broadcast(job);
    return toJobDTO(job);
  });
}

/** Used by GET /door/commands once there is no unlock to deliver. Errors propagate to the poll. */
export async function claimFingerprintCommand(deviceId: DeviceId): Promise<FingerprintCommand | null> {
  await resolveStaleJobs(deviceId);
  const cutoff = iso(Date.now() - Number(env.UNLOCK_COMMAND_TTL_SECONDS) * 1000);
  const job = await claimPendingJob(deviceId, cutoff);
  if (!job) return null;
  broadcast(job);
  return { command: job.type, jobId: job.id, slot: job.slot };
}

export async function reportJobProgressService(jobId: string, body: unknown): Promise<FingerprintJobDTO> {
  const input = reportJobProgressSchema.parse(body);
  const { deviceId } = input;
  assertKnownDevice(deviceId);
  if (!isUuid(jobId)) throw new AppError("FINGERPRINT_JOB_NOT_FOUND");

  return guard(async () => {
    // A job the backend already timed out must not be revived by a late report.
    await resolveStaleJobs(deviceId);

    let result: { job: FingerprintJobRow; fingerprint: FingerprintRow | null } | null;
    if (input.step === "SUCCEEDED") {
      result = await completeJob(jobId, deviceId);
    } else {
      const patch =
        input.step === "FAILED"
          ? ({ status: "FAILED", error: input.error } as const)
          : ({ step: input.step } as const);
      const job = await updateSentJob(jobId, deviceId, patch);
      result = job ? { job, fingerprint: null } : null;
    }

    if (!result) {
      const existing = await findJob(jobId, deviceId);
      throw new AppError(existing ? "FINGERPRINT_JOB_NOT_ACTIVE" : "FINGERPRINT_JOB_NOT_FOUND");
    }

    broadcast(result.job, result.fingerprint);
    return toJobDTO(result.job);
  });
}
