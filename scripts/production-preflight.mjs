#!/usr/bin/env node
/**
 * Phase 3B read-only production preflight.
 * Confirms the target is production ref zfpakilfxnwhlcfjgemw and records
 * whether CoW / downstream objects already exist.
 *
 * Usage (does not write):
 *   node scripts/production-preflight.mjs
 *
 * Loads `.env.local` by default (production host wiring on this workstation).
 * Never apply migrations from this script.
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "./load-env-file.mjs";

const PROTECTED_REF = "zfpakilfxnwhlcfjgemw";
const envFile = process.argv[2] || ".env.local";

if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}`);
  process.exit(1);
}

loadEnvFile(envFile, { override: true });

const url = process.env.SUPABASE_URL?.trim() ?? "";
let ref = null;
try {
  ref = new URL(url).hostname.split(".")[0] ?? null;
} catch {
  ref = null;
}

if (ref !== PROTECTED_REF) {
  console.error(
    `Preflight refused: expected production ref ${PROTECTED_REF}, got ${ref ?? "(invalid)"}`,
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function probe(label, fn) {
  try {
    return { label, ...(await fn()) };
  } catch (error) {
    return {
      label,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

const probes = [];

probes.push(
  await probe("support_cases_core", async () => {
    const { count, error } = await client
      .from("support_cases")
      .select("*", { count: "exact", head: true });
    return { ok: !error, count, code: error?.code ?? null, message: error?.message ?? null };
  }),
);

for (const [table, cols] of [
  ["support_cases", "demo_workspace_id, cloned_from_case_id"],
  ["human_decisions", "is_simulated"],
  ["engineering_handoffs", "is_simulated, decision_id"],
  ["demo_workspaces", "id"],
  ["demo_downstream_records", "id"],
  ["case_analyses", "assessment_version"],
]) {
  probes.push(
    await probe(`${table}:${cols}`, async () => {
      const { error } = await client.from(table).select(cols).limit(1);
      return {
        ok: !error,
        code: error?.code ?? null,
        message: error?.message?.slice(0, 160) ?? null,
        present: !error,
      };
    }),
  );
}

probes.push(
  await probe("purge_rpc", async () => {
    const { error } = await client.rpc("purge_expired_demo_workspaces", {
      p_now: "1970-01-01T00:00:00.000Z",
    });
    return {
      ok: !error,
      code: error?.code ?? null,
      message: error?.message?.slice(0, 160) ?? null,
      present: !error,
    };
  }),
);

probes.push(
  await probe("demo_templates", async () => {
    // Pre-migration: demo_workspace_id does not exist, so list by marker only.
    const { data, error } = await client
      .from("support_cases")
      .select("id, customer, status, issue_title")
      .ilike("customer", "%[DEMO]%")
      .order("customer");
    return {
      ok: !error,
      count: data?.length ?? 0,
      customers: (data || []).map((r) => ({
        customer: r.customer,
        status: r.status,
        title: r.issue_title,
      })),
      code: error?.code ?? null,
      message: error?.message ?? null,
    };
  }),
);

const report = {
  generatedAt: new Date().toISOString(),
  envFile,
  productionRef: ref,
  readOnly: true,
  cowMigrationApplied: probes.some(
    (p) => p.label.startsWith("demo_workspaces") && p.present,
  ),
  assessmentVersioningPresent: probes.some(
    (p) => p.label.startsWith("case_analyses:assessment_version") && p.present,
  ),
  probes,
};

const outPath = resolve(
  "docs/lifecycle-phase1-nov2026/phase3b-production-preflight-latest.json",
);
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ wrote: outPath, productionRef: ref, summary: {
  cowMigrationApplied: report.cowMigrationApplied,
  assessmentVersioningPresent: report.assessmentVersioningPresent,
  demoTemplateCount: report.probes.find((p) => p.label === "demo_templates")?.count ?? null,
} }, null, 2));
