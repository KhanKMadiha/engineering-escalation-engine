import { afterEach, describe, expect, it } from "vitest";
import {
  ConstraintViolationError,
  DuplicateDecisionError,
  ForeignKeyViolationError,
  mapDatabaseError,
} from "@/lib/repositories/persistence-errors";

describe("Phase 7 persistence error mapping", () => {
  it("maps unique human decision violations to DuplicateDecisionError", () => {
    const err = mapDatabaseError(
      {
        code: "23505",
        message: 'duplicate key value violates unique constraint "human_decisions_case_id_key"',
      },
      "persistDecisionOutcome case=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    expect(err).toBeInstanceOf(DuplicateDecisionError);
  });

  it("maps foreign key violations", () => {
    const err = mapDatabaseError(
      { code: "23503", message: "fk" },
      "saveAnalysis",
    );
    expect(err).toBeInstanceOf(ForeignKeyViolationError);
  });

  it("maps check / invalid data violations", () => {
    const err = mapDatabaseError(
      { code: "23514", message: "check" },
      "insert",
    );
    expect(err).toBeInstanceOf(ConstraintViolationError);
  });

  it("maps CASE_NOT_AWAITING_DECISION RPC failures", () => {
    const err = mapDatabaseError(
      { message: "CASE_NOT_AWAITING_DECISION" },
      "persistDecisionOutcome",
    );
    expect(err).toBeInstanceOf(ConstraintViolationError);
    expect(err.code).toBe("CASE_NOT_AWAITING_DECISION");
  });
});

describe("Phase 7 DecisionService does not import Supabase", () => {
  afterEach(() => {
    // no-op placeholder for symmetry with other suites
  });

  it("decision-service source stays database-agnostic", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../../src/lib/cases/decision-service.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/@supabase|supabase-js|from\("support_cases"\)/);
    expect(source).toContain("persistDecisionOutcome");
  });

  it("escalation engine source stays database-agnostic", async () => {
    const { readFile } = await import("node:fs/promises");
    const { readdir } = await import("node:fs/promises");
    const dir = new URL("../../src/lib/escalation/", import.meta.url);
    const files = await readdir(dir);
    for (const file of files.filter((f) => f.endsWith(".ts"))) {
      const source = await readFile(new URL(file, dir), "utf8");
      expect(source).not.toMatch(/supabase/i);
    }
  });
});
