import { env } from "../config/env";

export const hashData = (data: string) => {
  const hasher = new Bun.CryptoHasher("sha256", env.HASH_SECRET);
  return hasher.update(data).digest("hex");
};
export const compareHashes = (toHash: string, hashed: string) =>
  hashData(toHash) === hashed;
