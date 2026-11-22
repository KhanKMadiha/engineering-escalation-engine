#!/usr/bin/env node
/**
 * Phase 3C: targeted DEMO_INTERACTIVE_WRITES verification against .env.staging only.
 * Never loads .env.local. Refuses the protected production project ref.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "./load-env-file.mjs";

const PROTECTED_REF = "zfpakilfxnwhlcfjgemw";
const EXPECTED_STAGING_REF = "mmebhgkpylaxqvtjrvyt";
const stagingPath = resolve(process.cwd(), ".env.staging");

if (!existsSync(stagingPath)) {
  console.error("Phase 3C kill-switch blocked: `.env.staging` is missing.");
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
  console.error("Phase 3C kill-switch blocked: invalid SUPABASE_URL in `.env.staging`.");
  process.exit(1);
}

if (ref === PROTECTED_REF) {
  console.error(
    "Phase 3C kill-switch blocked: `.env.staging` points at protected production.",
  );
  process.exit(1);
}

if (ref !== EXPECTED_STAGING_REF) {
  console.error(
    `Phase 3C kill-switch blocked: expected staging ref ${EXPECTED_STAGING_REF}, got ${ref}.`,
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.error("Phase 3C kill-switch blocked: SUPABASE_SERVICE_ROLE_KEY missing.");
  process.exit(1);
}

if (!process.env.DEMO_WORKSPACE_SECRET?.trim()) {
  console.error("Phase 3C kill-switch blocked: DEMO_WORKSPACE_SECRET missing.");
  process.exit(1);
}

process.env.RUN_SUPABASE_INTEGRATION = "1";
process.env.CASE_REPOSITORY = "supabase";
// Start enabled; the suite toggles DEMO_INTERACTIVE_WRITES=0 then restores to 1.
process.env.DEMO_INTERACTIVE_WRITES = "1";

console.log(
  `Phase 3C: kill-switch verification against staging ref "${ref}" (credentials not printed).`,
);

const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "--no-file-parallelism",
    "tests/demo/phase3c-staging-kill-switch.test.ts",
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
