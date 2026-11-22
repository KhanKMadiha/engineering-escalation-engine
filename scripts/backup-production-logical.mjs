#!/usr/bin/env node
/**
 * Read-only logical backup of production app data via service_role (HTTPS).
 * Complements official `supabase db dump` when Docker/pg_dump are unavailable.
 * Does not modify production. Writes outside the git repo.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const PROTECTED_REF = "zfpakilfxnwhlcfjgemw";
const BACKUP_DIR = resolve(
  homedir(),
  "Madiha/Backups/eee-production-zfpakilfxnwhlcfjgemw-2026-11-22",
);
const OUT_DIR = join(BACKUP_DIR, "logical-service-role");

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const localEnv = loadEnv(resolve(process.cwd(), ".env.local"));
const url = localEnv.SUPABASE_URL?.trim() || "";
const key = localEnv.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
let ref;
try {
  ref = new URL(url).hostname.split(".")[0];
} catch {
  ref = null;
}
if (ref !== PROTECTED_REF || !key) {
  console.error("Refusing: .env.local must point at production with service role.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  "support_cases",
  "case_analyses",
  "escalation_results",
  "human_decisions",
  "engineering_handoffs",
  "case_events",
  "case_technical_evidence",
  "case_technical_evidence_attachments",
];

const tableSummaries = [];

for (const table of TABLES) {
  const { data, error } = await client.from(table).select("*");
  if (error) {
    // Table may not exist on this project — record and continue.
    tableSummaries.push({
      table,
      ok: false,
      code: error.code,
      message: error.message.slice(0, 160),
    });
    continue;
  }
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const file = join(OUT_DIR, `${table}.json`);
  writeFileSync(file, json);
  tableSummaries.push({
    table,
    ok: true,
    rows: data.length,
    bytes: Buffer.byteLength(json),
    sha256: sha256(json),
  });
}

const cases = JSON.parse(
  readFileSync(join(OUT_DIR, "support_cases.json"), "utf8"),
);
const demos = cases.filter((c) => String(c.customer || "").includes("[DEMO]"));
const requiredCustomers = [
  "Orchid Health",
  "Meridian Systems",
  "Vertex Media",
  "Northstar Financial",
  "Helix Analytics",
  "Cascade Retail",
  "Apex Digital",
  "Blue Harbor Logistics",
  "Brightline Insurance",
  "Summit Workforce",
];
const missingCustomers = requiredCustomers.filter(
  (name) => !demos.some((c) => String(c.customer).includes(name)),
);

const orchid = demos.find((c) => c.customer.includes("Orchid Health"));
const meridian = demos.find((c) => c.customer.includes("Meridian Systems"));
const vertex = demos.find((c) => c.customer.includes("Vertex Media"));

function loadTable(name) {
  const p = join(OUT_DIR, `${name}.json`);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf8"));
}

const decisions = loadTable("human_decisions");
const handoffs = loadTable("engineering_handoffs");
const analyses = loadTable("case_analyses");
const escalations = loadTable("escalation_results");
const events = loadTable("case_events");
const evidence = loadTable("case_technical_evidence");

const coverage = {
  demoCaseCount: demos.length,
  missingCustomers,
  orchid: orchid
    ? {
        status: orchid.status,
        hasAnalysis: analyses.some((a) => a.case_id === orchid.id),
        hasEscalation: escalations.some((e) => e.case_id === orchid.id),
      }
    : null,
  meridian: meridian
    ? {
        status: meridian.status,
        recommendation: escalations.find((e) => e.case_id === meridian.id)
          ?.recommendation,
      }
    : null,
  vertex: vertex
    ? {
        status: vertex.status,
        hasDecision: decisions.some((d) => d.case_id === vertex.id),
        hasHandoff: handoffs.some((h) => h.case_id === vertex.id),
        rationaleOk: /HTTP 504 gateway timeouts were reproduced/i.test(
          decisions.find((d) => d.case_id === vertex.id)?.rationale || "",
        ),
      }
    : null,
  totals: {
    decisions: decisions.length,
    handoffs: handoffs.length,
    analyses: analyses.length,
    escalations: escalations.length,
    events: events.length,
    technicalEvidence: evidence.length,
  },
};

const passed =
  demos.length === 10 &&
  missingCustomers.length === 0 &&
  coverage.orchid?.status === "awaiting_decision" &&
  coverage.meridian?.status === "investigation_continues" &&
  coverage.vertex?.status === "escalated" &&
  coverage.vertex?.hasDecision &&
  coverage.vertex?.hasHandoff &&
  coverage.vertex?.rationaleOk;

const manifest = {
  generatedAt: new Date().toISOString(),
  productionRef: PROTECTED_REF,
  method: "supabase-js service_role select * (read-only logical export)",
  note: "Not a substitute for official supabase db dump/pg_dump (schema+roles). Use for data recovery of app tables.",
  outDir: OUT_DIR,
  tables: tableSummaries,
  coverage,
  passed,
};

writeFileSync(
  join(OUT_DIR, "MANIFEST.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      ok: passed,
      outDir: OUT_DIR,
      demoCaseCount: demos.length,
      missingCustomers,
      totals: coverage.totals,
      orchid: coverage.orchid,
      meridian: coverage.meridian,
      vertex: {
        status: coverage.vertex?.status,
        hasDecision: coverage.vertex?.hasDecision,
        hasHandoff: coverage.vertex?.hasHandoff,
        rationaleOk: coverage.vertex?.rationaleOk,
      },
    },
    null,
    2,
  ),
);

process.exit(passed ? 0 : 1);
