#!/usr/bin/env node
/**
 * Phase 3A: run live Supabase integration tests against .env.staging only.
 * Never loads .env.local. Refuses the protected production project ref.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "./load-env-file.mjs";

const PROTECTED_REF = "zfpakilfxnwhlcfjgemw";
const stagingPath = resolve(process.cwd(), ".env.staging");

if (!existsSync(stagingPath)) {
  console.error(
    [
      "Phase 3A blocked: `.env.staging` is missing.",
      "",
      "Create an isolated Supabase project (not production), apply baseline",
      "migrations plus the two Phase 2 workspace migrations, then copy",
      "`.env.staging.example` → `.env.staging` and fill staging-only values.",
      "",
      "See docs/lifecycle-phase1-nov2026/PHASE-3A-STAGING-VERIFICATION.md",
      "Do not point this file at production project",
      PROTECTED_REF + ".",
    ].join("\n"),
  );
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

if (!ref) {
  console.error("Phase 3A blocked: SUPABASE_URL in `.env.staging` is invalid.");
  process.exit(1);
}

if (ref === PROTECTED_REF) {
  console.error(
    "Phase 3A blocked: `.env.staging` points at the protected production project. Use an isolated staging project.",
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.error(
    "Phase 3A blocked: SUPABASE_SERVICE_ROLE_KEY is missing in `.env.staging`.",
  );
  process.exit(1);
}

if (!process.env.DEMO_WORKSPACE_SECRET?.trim()) {
  console.error(
    "Phase 3A blocked: DEMO_WORKSPACE_SECRET is missing in `.env.staging`.",
  );
  process.exit(1);
}

process.env.RUN_SUPABASE_INTEGRATION = "1";
process.env.CASE_REPOSITORY = "supabase";

console.log(
  `Phase 3A: running live Supabase tests against staging project ref "${ref}" (credentials not printed).`,
);

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    // Live DB tests share one staging project; never purge across files in parallel.
    "--no-file-parallelism",
    "tests/demo/phase3a-supabase-staging.test.ts",
    "tests/repositories/demo-workspace-supabase-paths.test.ts",
    "tests/persistence/supabase-integration.test.ts",
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
