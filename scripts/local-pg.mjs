import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const PG_PORT = Number(process.env.PG_PORT || 5433);
const PG_USER = process.env.PG_USER || "postgres";
const PG_PASSWORD = process.env.PG_PASSWORD || "postgres";
const PG_DATABASE = process.env.PG_DATABASE || "deathbychocolate";
const DATA_DIR = path.resolve(process.cwd(), ".pgdata");
const INIT_ONLY = process.argv.includes("--init-only");

async function ensureDatabaseExists(pg) {
  const client = pg.getPgClient("postgres", "127.0.0.1");
  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [PG_DATABASE],
    );
    if (res.rowCount === 0) {
      await pg.createDatabase(PG_DATABASE);
      console.log(`[local-pg] Created database "${PG_DATABASE}".`);
    } else {
      console.log(`[local-pg] Database "${PG_DATABASE}" already exists.`);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const isInitialized = fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    authMethod: "password",
    persistent: true,
    onLog: (msg) => {
      const trimmed = String(msg).trim();
      if (trimmed) console.log(`[postgres] ${trimmed}`);
    },
    onError: (err) => {
      console.error("[postgres:error]", err);
    },
  });

  if (!isInitialized) {
    console.log(`[local-pg] Initializing cluster in ${DATA_DIR}...`);
    await pg.initialise();
  } else {
    console.log(`[local-pg] Using existing cluster in ${DATA_DIR}.`);
  }

  console.log(`[local-pg] Starting PostgreSQL on 127.0.0.1:${PG_PORT}...`);
  await pg.start();
  await ensureDatabaseExists(pg);
  console.log(
    `[local-pg] PostgreSQL ready at postgresql://${PG_USER}:****@127.0.0.1:${PG_PORT}/${PG_DATABASE}`,
  );

  if (INIT_ONLY) {
    console.log("[local-pg] --init-only complete. Stopping PostgreSQL...");
    await pg.stop();
    return;
  }

  const keepAlive = setInterval(() => {}, 60_000);
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(keepAlive);
    console.log(`[local-pg] Received ${signal}, stopping PostgreSQL...`);
    try {
      await pg.stop();
    } catch (err) {
      console.error("[local-pg] Error during stop:", err);
      process.exitCode = 1;
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[local-pg] Fatal error:", err);
  process.exit(1);
});
