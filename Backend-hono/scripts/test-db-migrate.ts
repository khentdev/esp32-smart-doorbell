import { getTestDatabaseUrl } from "../src/test/testDatabase";

const url = getTestDatabaseUrl();
const proc = Bun.spawn(["bunx", "prisma", "db", "migrate", "--db", url], {
  env: { ...Bun.env, DATABASE_URL: url },
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await proc.exited);
