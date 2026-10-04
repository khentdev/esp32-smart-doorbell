const DEFAULT_URL =
  "postgres://doorbell_test:doorbell_test@localhost:5433/doorbell_test";

/** URL of the isolated test database (docker-compose.test.yml unless overridden for CI). */
export function getTestDatabaseUrl(): string {
  const url = Bun.env.TEST_DATABASE_URL ?? DEFAULT_URL;
  const dbName = new URL(url).pathname.replace(/^\//, "");
  // The integration tests delete rows, so refuse anything not clearly a test DB.
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against database "${dbName}": its name must end with "_test".`,
    );
  }
  return url;
}
