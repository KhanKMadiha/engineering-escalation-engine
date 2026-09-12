/**
 * Explicit demo seed CLI.
 *
 * Usage:
 *   ALLOW_DEMO_SEED=1 npm run seed:demo
 *
 * Optional:
 *   CASE_REPOSITORY=supabase   # persist to Supabase (requires SUPABASE_* env)
 *   CASE_REPOSITORY=memory     # in-process only (exits after seed; use API route for UI)
 *
 * Loads `.env.local` if present. Never runs without ALLOW_DEMO_SEED=1.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertDemoSeedAllowed,
  seedDemoCases,
} from "../src/lib/demo/seed-demo-cases";
import {
  getCaseRepository,
  resolveCaseRepositoryBackend,
} from "../src/lib/repositories/get-case-repository";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  assertDemoSeedAllowed();

  const backend = resolveCaseRepositoryBackend();
  console.log(`Seeding demo cases (repository backend: ${backend})…`);

  if (backend === "memory") {
    console.warn(
      "Note: in-memory seed only lives in this process. For the Next.js UI with memory, use POST /api/demo/seed while `npm run dev` is running with ALLOW_DEMO_SEED=1.",
    );
  }

  const result = await seedDemoCases({
    repository: getCaseRepository(),
  });

  for (const skipped of result.skippedExistingTitles) {
    console.log(`Skipped (already exists): ${skipped}`);
  }

  for (const stale of result.staleSkipped) {
    const identityBits = [
      stale.existingProduct !== stale.expectedProduct
        ? `  stored product: ${stale.existingProduct} → expected: ${stale.expectedProduct}`
        : null,
      stale.existingCustomer !== stale.expectedCustomer
        ? `  stored customer: ${stale.existingCustomer} → expected: ${stale.expectedCustomer}`
        : null,
    ].filter(Boolean);
    console.warn(
      [
        `⚠ Stale demo case skipped (identity mismatch):`,
        `  key: ${stale.key}`,
        `  caseId: ${stale.caseId}`,
        ...identityBits,
        `  Clear this record and reseed to apply the canonical demo data.`,
      ].join("\n"),
    );
  }

  for (const leftover of result.leftoverDemoTitles) {
    console.warn(
      `⚠ Leftover [DEMO] case still present (clear before reseed): ${leftover}`,
    );
  }

  for (const item of result.seeded) {
    console.log(
      [
        `✓ ${item.label}`,
        `  caseId: ${item.caseId}`,
        `  status: ${item.status}`,
        `  recommendation: ${item.recommendation ?? "n/a"}`,
        `  score: ${item.escalationScore ?? "n/a"}`,
        item.analysisOk ? "" : `  analysis error: ${item.message ?? "failed"}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  console.log(
    "\nHuman approval was NOT recorded. Open each awaiting_decision case in the UI to approve/reject.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
