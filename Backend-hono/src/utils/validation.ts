import { z } from "zod";

export const deviceFingerprintSchema = z
  .string()
  .refine((value) => {
    try {
      const parsed = JSON.parse(value);
      return (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length > 0
      );
    } catch {
      return false;
    }
  });
