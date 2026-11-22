import { describe, expect, it, vi } from "vitest";
import { ensureDemoWorkspaceForWrite } from "@/lib/demo/demo-workspace-session";
import { DemoInteractiveWritesDisabledError } from "@/lib/security/runtime-access";
import type { CaseRepository } from "@/lib/repositories/case-repository";

vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies() must not be called when writes are disabled");
  },
}));

describe("demo interactive writes kill-switch", () => {
  it("blocks ensureDemoWorkspaceForWrite before creating or touching workspaces", async () => {
    const repository = {
      createDemoWorkspace: vi.fn(),
      getDemoWorkspace: vi.fn(),
      touchDemoWorkspace: vi.fn(),
    } as unknown as CaseRepository;

    await expect(
      ensureDemoWorkspaceForWrite(repository, {
        DEMO_INTERACTIVE_WRITES: "0",
      } as unknown as NodeJS.ProcessEnv),
    ).rejects.toBeInstanceOf(DemoInteractiveWritesDisabledError);

    expect(repository.createDemoWorkspace).not.toHaveBeenCalled();
    expect(repository.getDemoWorkspace).not.toHaveBeenCalled();
    expect(repository.touchDemoWorkspace).not.toHaveBeenCalled();
  });
});
