import { describe, expect, it } from "vitest";
import {
  DemoWorkspaceCookieError,
  signDemoWorkspaceCookie,
  verifyDemoWorkspaceCookie,
} from "@/lib/demo/demo-workspace-cookie";

describe("demo workspace signed cookies", () => {
  const env = {
    NODE_ENV: "test",
    DEMO_WORKSPACE_SECRET: "unit-test-secret",
  } as unknown as NodeJS.ProcessEnv;

  it("round-trips a signed workspace id", () => {
    const token = signDemoWorkspaceCookie("ws-123", {
      expiresAt: "2099-01-01T00:00:00.000Z",
      env,
    });
    expect(verifyDemoWorkspaceCookie(token, { env })).toBe("ws-123");
  });

  it("rejects tampered signatures", () => {
    const token = signDemoWorkspaceCookie("ws-123", {
      expiresAt: "2099-01-01T00:00:00.000Z",
      env,
    });
    const [payload] = token.split(".");
    expect(() =>
      verifyDemoWorkspaceCookie(`${payload}.tampered`, { env }),
    ).toThrow(DemoWorkspaceCookieError);
  });

  it("rejects expired cookies", () => {
    const token = signDemoWorkspaceCookie("ws-123", {
      expiresAt: "2020-01-01T00:00:00.000Z",
      env,
    });
    expect(() =>
      verifyDemoWorkspaceCookie(token, {
        env,
        now: new Date("2026-11-22T00:00:00.000Z"),
      }),
    ).toThrow(/expired/i);
  });
});
