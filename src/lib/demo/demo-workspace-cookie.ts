import { createHmac, timingSafeEqual } from "node:crypto";
import {
  DEMO_WORKSPACE_COOKIE,
  DEMO_WORKSPACE_TTL_MS,
  buildDemoWorkspaceExpiry,
} from "@/lib/demo/demo-workspace";

export { DEMO_WORKSPACE_COOKIE };

export class DemoWorkspaceCookieError extends Error {
  readonly code = "DEMO_WORKSPACE_COOKIE_INVALID" as const;

  constructor(message = "Invalid or expired demo workspace cookie.") {
    super(message);
    this.name = "DemoWorkspaceCookieError";
  }
}

type SignedWorkspacePayload = {
  workspaceId: string;
  expiresAt: string;
};

function getSigningSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.DEMO_WORKSPACE_SECRET?.trim();
  if (configured) {
    return configured;
  }
  // Tests / local next dev only — never rely on this in hosted deploys.
  if (env.NODE_ENV === "test" || env.VITEST === "true") {
    return "test-demo-workspace-secret";
  }
  if (env.NODE_ENV === "development") {
    return "dev-demo-workspace-secret";
  }
  throw new DemoWorkspaceCookieError(
    "DEMO_WORKSPACE_SECRET is required to issue demo workspace cookies.",
  );
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Issue a signed workspace cookie value (not a login session).
 * Format: `<base64url(json)>.<hmac>`
 */
export function signDemoWorkspaceCookie(
  workspaceId: string,
  options?: { expiresAt?: string; env?: NodeJS.ProcessEnv },
): string {
  const expiresAt =
    options?.expiresAt ?? buildDemoWorkspaceExpiry(new Date(), DEMO_WORKSPACE_TTL_MS);
  const payload: SignedWorkspacePayload = { workspaceId, expiresAt };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, getSigningSecret(options?.env));
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify signature + expiry. Returns workspace id or throws.
 */
export function verifyDemoWorkspaceCookie(
  cookieValue: string | null | undefined,
  options?: { now?: Date; env?: NodeJS.ProcessEnv },
): string {
  if (!cookieValue?.trim()) {
    throw new DemoWorkspaceCookieError("Demo workspace cookie is missing.");
  }

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) {
    throw new DemoWorkspaceCookieError();
  }

  const expected = signPayload(encodedPayload, getSigningSecret(options?.env));
  if (!safeEqual(signature, expected)) {
    throw new DemoWorkspaceCookieError("Demo workspace cookie signature mismatch.");
  }

  let payload: SignedWorkspacePayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as SignedWorkspacePayload;
  } catch {
    throw new DemoWorkspaceCookieError();
  }

  if (!payload.workspaceId || !payload.expiresAt) {
    throw new DemoWorkspaceCookieError();
  }

  const now = options?.now ?? new Date();
  if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
    throw new DemoWorkspaceCookieError("Demo workspace cookie has expired.");
  }

  return payload.workspaceId;
}

export function demoWorkspaceCookieOptions(expiresAt: string): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  };
}
