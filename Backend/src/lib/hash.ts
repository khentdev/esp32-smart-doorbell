import { createHmac } from 'crypto';
import { env } from '../configs/env.js';
export const hashData = (data: string) => createHmac("sha256", env.HASH_SECRET).update(data).digest("hex")
export const compareHashes = (toHash: string, hashed: string) => hashData(toHash) === hashed