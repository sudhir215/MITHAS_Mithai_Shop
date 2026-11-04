import {PrismaClient} from "@prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";
import {env} from "./env.js";

export function createPrismaClient({connectionString = env.DATABASE_URL} = {}) {
  if (!connectionString) {
    throw new Error("A database connection URL must be configured before starting the API server");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({adapter});
}
