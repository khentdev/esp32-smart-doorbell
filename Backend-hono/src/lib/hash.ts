import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

export const hashData = (data: string) => {
  const hasher = new Bun.CryptoHasher("sha256", env.HASH_SECRET);
  return hasher.update(data).digest("hex");
};

/** Constant-time string compare, for secrets (API keys, hashes). */
export const safeEqual = (a: string, b: string) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

export const compareHashes = (toHash: string, hashed: string) =>
  safeEqual(hashData(toHash), hashed);
