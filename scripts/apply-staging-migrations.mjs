#!/usr/bin/env node
/**
 * Apply Phase 3A migrations to staging Postgres only.
 * Requires DATABASE_URL or SUPABASE_DB_PASSWORD in `.env.staging`.
 * Refuses production project ref zfpakilfxnwhlcfjgemw.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadEnvFile } from "./load-env-file.mjs";

const PROTECTED_REF = "zfpakilfxnwhlcfjgemw";
const STAGING_SQL = resolve(
  process.cwd(),
  "supabase/staging/phase3a-apply.sql",
);

if (!existsSync(".env.staging")) {
  console.error("Missing .env.staging");
  process.exit(1);
}

loadEnvFile(".env.staging", { override: true });

const url = process.env.SUPABASE_URL?.trim() ?? "";
let ref = null;
try {
  ref = new URL(url).hostname.split(".")[0] ?? null;
} catch {
  ref = null;
}

if (!ref || ref === PROTECTED_REF) {
  console.error(
    "Refusing to apply migrations: staging SUPABASE_URL missing or points at production.",
  );
  process.exit(1);
}

if (!existsSync(STAGING_SQL)) {
  console.error(`Missing ${STAGING_SQL}`);
  process.exit(1);
}

const databaseUrl =
  process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim();
if (!databaseUrl) {
  console.error(
    [
      "Phase 3A migrations need a Postgres connection (service_role cannot run DDL).",
      "",
      "Option A (recommended):",
      "  1. Open Supabase → engineering-escalation-staging → SQL → New query",
      "  2. Paste contents of supabase/staging/phase3a-apply.sql and Run",
      "  3. Reply in chat: migrations applied",
      "",
      "Option B (scripted with psql):",
      "  Project Settings → Database → Connection string (URI)",
      "  Add to .env.staging (do not paste into chat):",
      "    DATABASE_URL=postgresql://postgres.<staging-ref>:<password>@.../postgres",
      "  Then: npm run db:migrate:staging",
      "",
      `Confirmed staging API ref: ${ref}`,
    ].join("\n"),
  );
  process.exit(1);
}

if (databaseUrl.includes(PROTECTED_REF)) {
  console.error("Refusing DATABASE_URL that references production.");
  process.exit(1);
}

console.log(
  `Applying Phase 3A SQL to staging ref "${ref}" (credentials not printed).`,
);

const psql = spawnSync(
  "psql",
  [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", STAGING_SQL],
  { stdio: "inherit", env: process.env },
);

if (psql.error?.code === "ENOENT") {
  console.error(
    [
      "`psql` is not installed on this machine.",
      "Use the Supabase SQL Editor with supabase/staging/phase3a-apply.sql instead,",
      "or install psql and re-run after setting SUPABASE_DB_PASSWORD / DATABASE_URL.",
    ].join("\n"),
  );
  process.exit(1);
}

process.exit(psql.status ?? 1);
