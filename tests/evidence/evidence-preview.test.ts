import { describe, expect, it } from "vitest";
import { evidenceBodyPreview } from "@/lib/evidence/evidence-preview";

describe("evidenceBodyPreview", () => {
  it("returns the first lines without mutating longer bodies", () => {
    const body = [
      "HTTP/1.1 500 Internal Server Error",
      "x-request-id: req-demo-48291",
      "",
      '{ "error": "Internal Server Error" }',
      "more lines that stay in storage",
    ].join("\n");
    const preview = evidenceBodyPreview(body, 80);
    expect(preview).toContain("HTTP/1.1 500");
    expect(preview!.length).toBeLessThanOrEqual(80);
    expect(body).toContain("more lines that stay in storage");
  });
});
