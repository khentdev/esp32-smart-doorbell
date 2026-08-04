import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '../../generated/prisma/client.js'
import { env } from '../configs/env.js'
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
export { prisma, Prisma }

