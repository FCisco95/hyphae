import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { serve } from "@hono/node-server";
import { createDb } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { readRoutes } from "../src/http/routes.js";

// Local preview only: no bot, worker, jobs, migrations, signer or private auth route.
async function main() {
  const values = parseEnv(readFileSync(new URL("../../../.env", import.meta.url), "utf8"));
  const url = process.env.DATABASE_URL || values.DATABASE_URL;
  if (!url) throw new Error("Missing read configuration");
  const db = createDb(url);
  await db.execute(sql`select 1`);
  const reads = readRoutes({ db });
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true, pid: process.pid }));
  app.get("/v1/communities/:mint/raids", (c) =>
    reads.fetch(
      new Request(
        new URL(`/communities/${encodeURIComponent(c.req.param("mint"))}/raids`, c.req.url),
        { headers: c.req.raw.headers },
      ),
    ),
  );
  serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 3011 }, () => {
    console.log("Local read-only raid preview ready on loopback3011.");
  });
}
main().catch(() => {
  console.error("Read-only raid preview could not start. Check local read configuration.");
  process.exit(1);
});
