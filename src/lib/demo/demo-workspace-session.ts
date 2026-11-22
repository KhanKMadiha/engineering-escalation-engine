import { cookies } from "next/headers";
import {
  DEMO_WORKSPACE_TTL_MS,
  buildDemoWorkspaceExpiry,
  isDemoWorkspaceExpired,
} from "@/lib/demo/demo-workspace";
import {
  DEMO_WORKSPACE_COOKIE,
  DemoWorkspaceCookieError,
  demoWorkspaceCookieOptions,
  signDemoWorkspaceCookie,
  verifyDemoWorkspaceCookie,
} from "@/lib/demo/demo-workspace-cookie";
import { getCaseRepository } from "@/lib/repositories/get-case-repository";
import type { CaseRepository } from "@/lib/repositories/case-repository";
import { assertDemoInteractiveWritesAllowed } from "@/lib/security/runtime-access";
import type { DemoWorkspace } from "@/types";

export type DemoWorkspaceSession = {
  workspaceId: string;
  workspace: DemoWorkspace;
  /** True when this call created a new workspace + cookie. */
  created: boolean;
};

/**
 * Read + verify the workspace cookie without creating anything.
 * Returns null when missing, invalid, expired, or the workspace row is gone.
 */
export async function getOptionalDemoWorkspaceId(
  repository: CaseRepository = getCaseRepository(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  let raw: string | undefined;
  try {
    const jar = await cookies();
    raw = jar.get(DEMO_WORKSPACE_COOKIE)?.value;
  } catch {
    // Outside a Next.js request context (unit tests / scripts).
    return null;
  }
  if (!raw) {
    return null;
  }

  let workspaceId: string;
  try {
    workspaceId = verifyDemoWorkspaceCookie(raw, { env });
  } catch (error) {
    if (error instanceof DemoWorkspaceCookieError) {
      return null;
    }
    throw error;
  }

  if (!repository.getDemoWorkspace) {
    return null;
  }

  const workspace = await repository.getDemoWorkspace(workspaceId);
  if (!workspace || isDemoWorkspaceExpired(workspace)) {
    return null;
  }

  return workspaceId;
}

/**
 * Ensure a private workspace exists for a supported write action.
 * Does not create a workspace on browse/read — call only from mutation paths.
 */
export async function ensureDemoWorkspaceForWrite(
  repository: CaseRepository = getCaseRepository(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<DemoWorkspaceSession> {
  // Emergency read-only switch: block new demo mutations while keeping reads.
  assertDemoInteractiveWritesAllowed(env);

  if (
    !repository.createDemoWorkspace ||
    !repository.getDemoWorkspace ||
    !repository.touchDemoWorkspace
  ) {
    throw new Error(
      "Demo workspaces are not supported by the active case repository.",
    );
  }

  const jar = await cookies();
  const raw = jar.get(DEMO_WORKSPACE_COOKIE)?.value;

  if (raw) {
    try {
      const workspaceId = verifyDemoWorkspaceCookie(raw, { env });
      const existing = await repository.getDemoWorkspace(workspaceId);
      if (existing && !isDemoWorkspaceExpired(existing)) {
        const now = new Date().toISOString();
        await repository.touchDemoWorkspace(workspaceId, now);
        const touched = (await repository.getDemoWorkspace(workspaceId))!;
        return { workspaceId, workspace: touched, created: false };
      }
    } catch (error) {
      if (!(error instanceof DemoWorkspaceCookieError)) {
        throw error;
      }
      // Fall through and issue a fresh workspace.
    }
  }

  const now = new Date();
  const expiresAt = buildDemoWorkspaceExpiry(now, DEMO_WORKSPACE_TTL_MS);
  const workspace: DemoWorkspace = {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    expiresAt,
  };

  await repository.createDemoWorkspace(workspace);
  jar.set(
    DEMO_WORKSPACE_COOKIE,
    signDemoWorkspaceCookie(workspace.id, { expiresAt, env }),
    demoWorkspaceCookieOptions(expiresAt),
  );

  return { workspaceId: workspace.id, workspace, created: true };
}
