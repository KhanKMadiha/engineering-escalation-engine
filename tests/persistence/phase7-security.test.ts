import { afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  getCaseRepository,
  resetCaseRepositoryCache,
  resolveCaseRepositoryBackend,
} from "@/lib/repositories/get-case-repository";
import {
  getInMemoryCaseRepository,
  resetInMemoryCaseRepository,
} from "@/lib/repositories/in-memory-case-repository";
import { InMemoryCaseRepository } from "@/lib/repositories/in-memory-case-repository";
import { redactSecrets } from "@/lib/security/safe-log";

const root = path.resolve(import.meta.dirname, "../..");

describe("Phase 7 wiring and security", () => {
  afterEach(() => {
    delete process.env.CASE_REPOSITORY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetCaseRepositoryCache();
    resetInMemoryCaseRepository();
  });

  it("wires getCaseRepository to in-memory by default", () => {
    expect(resolveCaseRepositoryBackend()).toBe("memory");
    const repo = getCaseRepository();
    expect(repo).toBeInstanceOf(InMemoryCaseRepository);
    expect(repo).toBe(getInMemoryCaseRepository());
  });

  it("23. server-only Supabase client is not imported by client components", async () => {
    const clientTs = await readFile(
      path.join(root, "src/lib/supabase/client.ts"),
      "utf8",
    );
    expect(clientTs).toContain('import "server-only"');
    expect(clientTs).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE");

    const clientComponents = [
      "src/components/cases/CaseForm.tsx",
      "src/components/cases/AnalyzeCaseButton.tsx",
      "src/components/cases/HumanDecisionPanel.tsx",
    ];
    for (const relative of clientComponents) {
      const source = await readFile(path.join(root, relative), "utf8");
      expect(source).not.toMatch(/supabase/i);
      expect(source).not.toMatch(/SERVICE_ROLE/);
      expect(source).not.toMatch(/getCaseRepository|SupabaseCaseRepository/);
    }
  });

  it("24–25. secrets and case bodies are not logged via safe logger helpers", () => {
    expect(
      redactSecrets("SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi.secret.payload"),
    ).toContain("[REDACTED]");
    expect(redactSecrets("Bearer abc.def.ghi")).toContain("[REDACTED]");

    const safeLog = `
      logOperationalError("scope", { caseId: "c1", event: "fail", message: "db" });
    `;
    expect(safeLog).not.toMatch(/issueDescription|logsErrors|prompt/);
  });

  it("env example documents server-only Supabase placeholders", async () => {
    const example = await readFile(path.join(root, ".env.example"), "utf8");
    expect(example).toContain("SUPABASE_URL=");
    expect(example).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(example).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/);
  });
});
