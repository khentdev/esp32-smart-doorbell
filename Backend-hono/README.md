# my-hono-api

A minimal hono app with Prisma 8 and Prisma Composer.

## Run locally

```bash
bun run dev:composer
```

This builds the app and starts it with Composer. PostgreSQL projects get a local Prisma Postgres database and apply the contract automatically.

## Deploy

```bash
bun run deploy
```

The deploy script builds the framework output, provisions Prisma Postgres when selected, applies migrations, and deploys the app to Prisma Compute.

The starter users are inserted idempotently from `src/prisma/seed.ts` on the first database query through the Composer service binding.


## Prisma

- Contract: `src/prisma/contract.prisma`
- Prisma and Composer config: `prisma.config.ts`
- Composer app: `module.ts` and `service.ts`

After changing the contract, run:

```bash
bun run contract:emit
```

To use the framework's development server directly, run `bun run dev`. This direct mode requires `DATABASE_URL`.

## Running tests

Integration tests run against a throwaway Postgres in Docker (port 5433), never the dev database.

```bash
bun run test                                # starts the DB, applies migrations, runs bun test
bun run test -- get-session.integration.test  # a single file
bun run test:db:down                        # remove the test container
```

Requires Docker. In CI, set `TEST_DATABASE_URL` (database name must end in `_test`).
