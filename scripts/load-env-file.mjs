import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Parse a dotenv-style file into process.env without printing values.
 * Does not overwrite keys already set in the environment.
 */
export function loadEnvFile(relativePath, { override = false } = {}) {
  const absolute = resolve(process.cwd(), relativePath);
  if (!existsSync(absolute)) {
    return { loaded: false, absolute };
  }

  const text = readFileSync(absolute, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!override && process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }

  return { loaded: true, absolute };
}
