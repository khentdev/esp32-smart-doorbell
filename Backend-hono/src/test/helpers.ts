import { db } from "../prisma/db";

export const TEST_PASSWORD = "password123123123";

export const deviceFingerprint =
  '{"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36","language":"en-US","platform":"Win32","screen":{"width":1920,"height":1080,"colorDepth":24},"timezone":"Asia/Manila","hardwareConcurrency":8,"deviceMemory":16,"touchSupport":false,"canvas":"7f3c8d2a91b4e6ff","webgl":"Intel Iris Xe Graphics"}';

export const otherFingerprint =
  '{"userAgent":"Different/1.0","language":"en-US","platform":"Linux","screen":{"width":1280,"height":720,"colorDepth":24},"timezone":"UTC","hardwareConcurrency":4,"deviceMemory":8,"touchSupport":false,"canvas":"aabbccdd","webgl":"Mesa"}';

export const seedUser = async (username: string) =>
  db.orm.public.User.create({
    username,
    hashedPassword: await Bun.password.hash(TEST_PASSWORD),
  });

export const deleteUser = (username: string) =>
  db.orm.public.User.where({ username }).delete();

export type ErrorBody = { error: { code: string } };
