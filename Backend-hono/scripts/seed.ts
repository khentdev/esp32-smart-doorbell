import { connectDatabase, db } from "../src/prisma/db";

const username = Bun.env.SEED_USERNAME ?? "admin";
const password = Bun.env.SEED_PASSWORD ?? "admin12345";

await connectDatabase();

const existing = await db.orm.public.User.select("id").first({ username });

if (existing) {
  console.log(`User "${username}" already exists, nothing to do.`);
} else {
  await db.orm.public.User.create({
    username,
    hashedPassword: await Bun.password.hash(password),
  });
  console.log(`Created user "${username}" with password "${password}".`);
}

process.exit(0);
