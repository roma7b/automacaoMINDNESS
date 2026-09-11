import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const client = createClient({ url });
  const db = drizzle(client);

  console.log(`Aplicando migrações em ${url}...`);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrações aplicadas com sucesso.");

  client.close();
}

main().catch((error) => {
  console.error("Falha ao aplicar migrações:", error);
  process.exit(1);
});
