import { describe, expect, it } from "vitest";
import {
  PROTECTED_PRODUCTION_SUPABASE_REF,
  ProtectedSupabaseTargetError,
  assertNotProtectedProductionSupabase,
  extractSupabaseProjectRef,
} from "@/lib/supabase/staging-guard";

describe("staging-guard", () => {
  it("extracts the project ref from a Supabase URL", () => {
    expect(
      extractSupabaseProjectRef(
        `https://${PROTECTED_PRODUCTION_SUPABASE_REF}.supabase.co`,
      ),
    ).toBe(PROTECTED_PRODUCTION_SUPABASE_REF);
  });

  it("refuses the protected production project", () => {
    expect(() =>
      assertNotProtectedProductionSupabase(
        `https://${PROTECTED_PRODUCTION_SUPABASE_REF}.supabase.co`,
        { context: "phase3a" },
      ),
    ).toThrow(ProtectedSupabaseTargetError);
  });

  it("allows a non-production staging ref", () => {
    expect(
      assertNotProtectedProductionSupabase(
        "https://abcdefghijklmnop.supabase.co",
      ),
    ).toBe("abcdefghijklmnop");
  });
});
