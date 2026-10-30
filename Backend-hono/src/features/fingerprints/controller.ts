import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import {
  deleteFingerprintService,
  enrollFingerprintService,
  listFingerprintsService,
  renameFingerprintService,
  reportJobProgressService,
} from "./service";
import type { FingerprintDTO, FingerprintJobDTO, ListFingerprintsResponse } from "./types";

export async function listFingerprintsController(c: Context<AppContext>) {
  const result = await listFingerprintsService(c.req.query("deviceId") ?? "");
  return c.json<ListFingerprintsResponse>(result, 200);
}

export async function enrollFingerprintController(c: Context<AppContext>) {
  const job = await enrollFingerprintService(await c.req.json());
  return c.json<FingerprintJobDTO>(job, 202);
}

export async function renameFingerprintController(c: Context<AppContext>) {
  const fingerprint = await renameFingerprintService(c.req.param("id") ?? "", await c.req.json());
  return c.json<FingerprintDTO>(fingerprint, 200);
}

export async function deleteFingerprintController(c: Context<AppContext>) {
  const job = await deleteFingerprintService(c.req.param("id") ?? "");
  return c.json<FingerprintJobDTO>(job, 202);
}

export async function reportJobProgressController(c: Context) {
  const job = await reportJobProgressService(c.req.param("jobId") ?? "", await c.req.json());
  return c.json<FingerprintJobDTO>(job, 200);
}
