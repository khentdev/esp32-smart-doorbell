import { z } from "zod";

export const MAX_NAME_LENGTH = 40;

export const JOB_STEPS = ["PLACE_FINGER", "REMOVE_FINGER", "PLACE_AGAIN"] as const;

// DEVICE_TIMEOUT is set by the backend only, so the ESP32 can't report it.
export const DEVICE_JOB_ERRORS = [
  "MISMATCH",
  "TIMEOUT",
  "BAD_IMAGE",
  "STORE_FAILED",
  "DELETE_FAILED",
] as const;

const nameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);

// A non-string or missing deviceId becomes "" so the service rejects it as
// UNKNOWN_DEVICE_ID, the same as the door feature.
export const enrollFingerprintSchema = z.object({
  deviceId: z.string().catch(""),
  name: nameSchema,
});

export const renameFingerprintSchema = z.object({
  name: nameSchema,
});

export const reportJobProgressSchema = z
  .object({
    deviceId: z.string().catch(""),
    step: z.enum([...JOB_STEPS, "SUCCEEDED", "FAILED"]),
    error: z.enum(DEVICE_JOB_ERRORS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.step === "FAILED" && !value.error) {
      ctx.addIssue({
        code: "custom",
        path: ["error"],
        message: "error is required when step is FAILED",
      });
    }
    if (value.step !== "FAILED" && value.error) {
      ctx.addIssue({
        code: "custom",
        path: ["error"],
        message: "error must be omitted unless step is FAILED",
      });
    }
  });

/** Ids are uuids; anything else can't match a row, so callers treat it as not found. */
export const isUuid = (value: string) => z.uuid().safeParse(value).success;
