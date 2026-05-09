import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../infrastructure/db/schema";
import path from "path";

export async function setup() {
  const pool = new Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.TEST_DB_PORT ?? 5434),
    user: process.env.DB_USER ?? "concert_user",
    password: process.env.DB_PASSWORD ?? "concert_pass",
    database: process.env.TEST_DB_NAME ?? "concert_test_db",
  });

  const testDb = drizzle(pool, { schema });

  await migrate(testDb, {
    migrationsFolder: path.join(__dirname, "../../infrastructure/db/migrations"),
  });

  console.log("Test DB migrated");
  await pool.end();
}

export async function teardown() {

}
