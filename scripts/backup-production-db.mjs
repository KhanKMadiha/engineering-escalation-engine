#!/usr/bin/env node
/**
 * Official PostgreSQL logical backup for production Free-plan project.
 * Prefer native pg_dump/pg_dumpall (no Docker). Falls back to Supabase CLI
 * only when native tools are unavailable.
 *
 * Read-only dump. Does not modify production data.
 *
 * Requires private credentials file OUTSIDE the git repo:
 *   ~/Madiha/Backups/eee-production-zfpakilfxnwhlcfjgemw-2026-11-22/.env.backup
 *
 * Usage:
 *   node scripts/backup-production-db.mjs
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const PROTECTED_REF = "zfpakilfxnwhlcfjgemw";
const BACKUP_DIR_CANDIDATES = [
  resolve(homedir(), "Madiha/Backups/eee-production-zfpakilfxnwhlcfjgemw-2026-11-22"),
  resolve(homedir(), "Madiha/backups/eee-production-zfpakilfxnwhlcfjgemw-2026-11-22"),
];
const BACKUP_DIR =
  BACKUP_DIR_CANDIDATES.find((dir) => existsSync(join(dir, ".env.backup"))) ||
  BACKUP_DIR_CANDIDATES[0];
const CRED_FILE = join(BACKUP_DIR, ".env.backup");
const REPO_ROOT = resolve(process.cwd());
const SUPABASE_BIN = resolve(REPO_ROOT, "node_modules/.bin/supabase");
const TOOLS_PREFIX = join(BACKUP_DIR, ".tools/prefix/opt/libpq/bin");

function loadEnvFile(path) {
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

function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function which(bin) {
  const candidates = [
    join(TOOLS_PREFIX, bin),
    join(homedir(), `Homebrew/opt/libpq/bin/${bin}`),
    join("/opt/homebrew/opt/libpq/bin", bin),
    join("/usr/local/opt/libpq/bin", bin),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  const found = spawnSync("which", [bin], { encoding: "utf8" });
  if (found.status === 0) return found.stdout.trim();
  return null;
}

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const err = result.stderr || result.stdout || `${cmd} failed`;
    throw new Error(err);
  }
  return result;
}

if (!existsSync(CRED_FILE)) {
  console.error(
    [
      "Missing private credentials file:",
      CRED_FILE,
      "",
      "Create it from .env.backup.example in that folder with:",
      "  SUPABASE_DB_PASSWORD=<password from Project Settings → Database>",
      "for production ref",
      PROTECTED_REF + ".",
      "Do not paste secrets into chat.",
    ].join("\n"),
  );
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });
const creds = loadEnvFile(CRED_FILE);
const password = creds.SUPABASE_DB_PASSWORD?.trim() || "";
let databaseUrl = creds.DATABASE_URL?.trim() || "";

if (!password && !databaseUrl) {
  console.error(
    "Provide SUPABASE_DB_PASSWORD or DATABASE_URL in .env.backup.",
  );
  process.exit(1);
}

// Prefer direct connection (IPv6 OK on this Mac). Session pooler only if supplied.
if (!databaseUrl) {
  databaseUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${PROTECTED_REF}.supabase.co:5432/postgres`;
}

const pgDump = which("pg_dump");
const pgDumpall = which("pg_dumpall");
const psql = which("psql");
const useNative = Boolean(pgDump);

const schemaFile = join(BACKUP_DIR, "schema.sql");
const dataFile = join(BACKUP_DIR, "data.sql");
const rolesFile = join(BACKUP_DIR, "roles.sql");
const policiesFile = join(BACKUP_DIR, "policies.sql");

let method;
let serverVersion = null;
let clientVersion = null;

if (useNative) {
  method = "native pg_dump / pg_dumpall (direct connection)";
  clientVersion = run(pgDump, ["--version"]).stdout.trim();
  console.log(`Using ${clientVersion}`);
  console.log(
    `Connection: direct db.${PROTECTED_REF}.supabase.co:5432 (password redacted)`,
  );

  if (psql) {
    try {
      const ver = run(
        psql,
        [databaseUrl, "-v", "ON_ERROR_STOP=1", "-tAc", "SHOW server_version;"],
        { PGCONNECT_TIMEOUT: "30" },
      );
      serverVersion = ver.stdout.trim();
      console.log(`Server: PostgreSQL ${serverVersion}`);
    } catch (e) {
      console.warn(
        "Could not query server_version via psql:",
        String(e.message || e).slice(0, 200),
      );
    }
  }

  // Compatibility: pg_dump major must be >= server major
  if (serverVersion && clientVersion) {
    const serverMajor = Number.parseInt(serverVersion, 10);
    const clientMajor = Number.parseInt(
      clientVersion.replace(/^.*\b(\d+)\.\d+.*$/, "$1"),
      10,
    );
    if (
      Number.isFinite(serverMajor) &&
      Number.isFinite(clientMajor) &&
      clientMajor < serverMajor
    ) {
      console.error(
        `pg_dump ${clientMajor} cannot dump server ${serverMajor}. Install libpq >= ${serverMajor}.`,
      );
      process.exit(1);
    }
  }

  console.log("Dumping schema (includes tables, functions, RLS policies)…");
  run(pgDump, [
    databaseUrl,
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "-f",
    schemaFile,
  ]);

  console.log("Dumping data…");
  run(pgDump, [
    databaseUrl,
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "--disable-triggers",
    "-f",
    dataFile,
  ]);

  // Explicit policies extract for easy review (also present in schema.sql)
  console.log("Extracting CREATE POLICY statements…");
  const schemaText = readFileSync(schemaFile, "utf8");
  const policyLines = schemaText
    .split(/\n/)
    .filter((l) => /^\s*CREATE POLICY\b/i.test(l) || /^\s*ALTER POLICY\b/i.test(l));
  writeFileSync(
    policiesFile,
    [
      "-- Extracted from schema.sql for review",
      `-- productionRef: ${PROTECTED_REF}`,
      `-- generatedAt: ${new Date().toISOString()}`,
      "",
      ...policyLines,
      "",
    ].join("\n"),
  );

  if (pgDumpall) {
    console.log("Dumping roles…");
    try {
      run(pgDumpall, [
        `--dbname=${databaseUrl}`,
        "--roles-only",
        "--no-role-passwords",
        "-f",
        rolesFile,
      ]);
    } catch (e) {
      const msg = String(e.message || e);
      writeFileSync(
        rolesFile,
        [
          "-- roles dump incomplete (expected on managed Supabase without full dumpall rights)",
          `-- error: ${msg.split("\n")[0].slice(0, 300)}`,
          "",
        ].join("\n"),
      );
      console.warn(
        "roles.sql partial/unavailable via pg_dumpall; wrote error stub. Schema grants may still appear in schema.sql if privileges were included.",
      );
    }
  } else {
    writeFileSync(
      rolesFile,
      "-- pg_dumpall not found; roles not dumped\n",
    );
  }
} else {
  if (!existsSync(SUPABASE_BIN)) {
    console.error(
      "Neither native pg_dump nor Supabase CLI found. Install libpq (pg_dump) or: npm install --no-save supabase",
    );
    process.exit(1);
  }
  if (!password) {
    console.error("Supabase CLI path requires SUPABASE_DB_PASSWORD.");
    process.exit(1);
  }
  method = "supabase db dump (official CLI; requires Docker)";
  console.log(
    "Native pg_dump not found; falling back to supabase db dump (needs Docker).",
  );

  function runDump(extraFlags, outFile) {
    console.log(
      `Running: supabase db dump --remote=${PROTECTED_REF} --password=[redacted] ${extraFlags.join(" ")} -f ${outFile}`,
    );
    run(SUPABASE_BIN, [
      "db",
      "dump",
      "--remote",
      PROTECTED_REF,
      "--password",
      password,
      ...extraFlags,
      "-f",
      outFile,
    ]);
  }

  runDump([], schemaFile);
  runDump(["--data-only"], dataFile);
  runDump(["--role-only"], rolesFile);
  writeFileSync(
    policiesFile,
    "-- policies are embedded in schema.sql for CLI dump path\n",
  );
}

const files = [schemaFile, dataFile, rolesFile, policiesFile];
for (const file of [schemaFile, dataFile]) {
  if (!existsSync(file) || statSync(file).size < 32) {
    console.error(`Dump incomplete or empty: ${file}`);
    process.exit(1);
  }
}

const dataText = readFileSync(dataFile, "utf8");
const schemaText = readFileSync(schemaFile, "utf8");
const requiredDataMarkers = [
  "[DEMO] Orchid Health",
  "[DEMO] Meridian Systems",
  "[DEMO] Vertex Media",
  "support_cases",
  "case_analyses",
  "human_decisions",
  "engineering_handoffs",
  "case_events",
];
const requiredSchemaMarkers = [
  "CREATE TABLE",
  "support_cases",
  "case_analyses",
  "escalation_results",
];
const missingData = requiredDataMarkers.filter((m) => !dataText.includes(m));
const missingSchema = requiredSchemaMarkers.filter(
  (m) => !schemaText.includes(m),
);
const policyCount = (schemaText.match(/\bCREATE POLICY\b/gi) || []).length;

const manifest = {
  generatedAt: new Date().toISOString(),
  productionRef: PROTECTED_REF,
  method,
  readOnly: true,
  connection: databaseUrl.includes("pooler.supabase.com")
    ? "pooler"
    : "direct",
  clientVersion,
  serverVersion,
  files: files
    .filter((f) => existsSync(f))
    .map((f) => ({
      name: f.split("/").pop(),
      bytes: statSync(f).size,
      sha256: sha256File(f),
    })),
  contentChecks: {
    requiredDataMarkers,
    missingDataMarkers: missingData,
    requiredSchemaMarkers,
    missingSchemaMarkers: missingSchema,
    policyCount,
    passed: missingData.length === 0 && missingSchema.length === 0,
  },
  notes: [
    "logical-service-role/ left untouched (prior verified app-data export).",
    "schema.sql includes RLS policies; policies.sql is an extracted review copy.",
    "Restore drill requires an isolated Postgres/Supabase project — not performed by this script.",
  ],
};

const manifestPath = join(BACKUP_DIR, "MANIFEST.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
chmodSync(manifestPath, 0o600);
for (const f of files) {
  if (existsSync(f)) chmodSync(f, 0o600);
}

if (!manifest.contentChecks.passed) {
  console.error(
    "Backup integrity check failed;",
    JSON.stringify(manifest.contentChecks, null, 2),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      backupDir: BACKUP_DIR,
      method,
      clientVersion,
      serverVersion,
      policyCount,
      files: manifest.files.map((f) => ({ name: f.name, bytes: f.bytes })),
      contentChecksPassed: true,
    },
    null,
    2,
  ),
);
