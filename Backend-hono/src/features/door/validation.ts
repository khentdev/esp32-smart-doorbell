import { z } from "zod";

export const ACCESS_OUTCOMES = ["GRANTED", "DENIED", "ADMIN_UNLOCK"] as const;

// A non-string or missing deviceId becomes "" so it is rejected as UNKNOWN_DEVICE_ID
// by the service, the same as every other unknown id.
export const reportAccessSchema = z
  .object({
    deviceId: z.string().catch(""),
    outcome: z.enum(ACCESS_OUTCOMES),
    fingerprintSlot: z.number().int().min(0).nullish(),
  })
  .superRefine((value, ctx) => {
    const hasSlot = value.fingerprintSlot != null;
    if (value.outcome === "GRANTED" && !hasSlot) {
      ctx.addIssue({
        code: "custom",
        path: ["fingerprintSlot"],
        message: "fingerprintSlot is required when outcome is GRANTED",
      });
    }
    if (value.outcome !== "GRANTED" && hasSlot) {
      ctx.addIssue({
        code: "custom",
        path: ["fingerprintSlot"],
        message: "fingerprintSlot must be omitted or null unless outcome is GRANTED",
      });
    }
  })
  .transform((value) => ({
    ...value,
    fingerprintSlot: value.fingerprintSlot ?? null,
  }));
