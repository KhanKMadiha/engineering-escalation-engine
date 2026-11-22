import { describe, expect, it } from "vitest";
import {
  buildDemoWorkspaceExpiry,
  isDemoForkCase,
  isDemoTemplateCase,
  isDemoWorkspaceExpired,
} from "@/lib/demo/demo-workspace";

describe("demo workspace helpers (Approach D)", () => {
  it("treats cases without workspace id as immutable templates", () => {
    expect(isDemoTemplateCase({ demoWorkspaceId: null })).toBe(true);
    expect(isDemoTemplateCase({ demoWorkspaceId: undefined })).toBe(true);
    expect(isDemoTemplateCase({ demoWorkspaceId: "ws-1" })).toBe(false);
  });

  it("recognises copy-on-write forks", () => {
    expect(
      isDemoForkCase({
        demoWorkspaceId: "ws-1",
        clonedFromCaseId: "template-1",
      }),
    ).toBe(true);
    expect(
      isDemoForkCase({
        demoWorkspaceId: "ws-1",
        clonedFromCaseId: null,
      }),
    ).toBe(false);
  });

  it("computes expiry and detects expired workspaces", () => {
    const from = new Date("2026-11-22T12:00:00.000Z");
    const expiresAt = buildDemoWorkspaceExpiry(from, 60_000);
    expect(expiresAt).toBe("2026-11-22T12:01:00.000Z");
    expect(
      isDemoWorkspaceExpired(
        { expiresAt },
        new Date("2026-11-22T12:00:30.000Z"),
      ),
    ).toBe(false);
    expect(
      isDemoWorkspaceExpired(
        { expiresAt },
        new Date("2026-11-22T12:01:00.000Z"),
      ),
    ).toBe(true);
  });
});
