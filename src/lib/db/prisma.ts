import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConnectionString } from "@/lib/runtime/deployment-policy.mjs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: databaseConnectionString() });
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

// Pure helpers and build-time imports must not need database credentials.
// Resolve and validate the connection before the first actual client operation.
let client: PrismaClient | undefined;
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    client ??= globalForPrisma.prisma ?? createPrismaClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
