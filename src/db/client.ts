import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  libsqlClient?: ReturnType<typeof createClient>;
};

function getClient() {
  if (!globalForDb.libsqlClient) {
    const env = getEnv();
    globalForDb.libsqlClient = createClient({ url: env.DATABASE_URL });
  }
  return globalForDb.libsqlClient;
}

export const db = drizzle(getClient(), { schema });
