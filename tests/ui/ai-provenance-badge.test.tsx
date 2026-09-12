import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AI_PROVENANCE_TOOLTIP,
  AIProvenanceBadge,
} from "@/components/cases/AIProvenanceBadge";
import { ProvenanceBadge } from "@/components/cases/ProvenanceBadge";

describe("AIProvenanceBadge", () => {
  it("renders a compact focusable badge with associated tooltip copy", () => {
    const html = renderToStaticMarkup(<AIProvenanceBadge />);

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("hidden");
    expect(html).toContain(AI_PROVENANCE_TOOLTIP.title);
    expect(html).toContain(AI_PROVENANCE_TOOLTIP.body);
    expect(html).toMatch(/>AI</);
  });

  it("is used by ProvenanceBadge for ai_inference sources", () => {
    const html = renderToStaticMarkup(
      <ProvenanceBadge source="ai_inference" />,
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toContain(AI_PROVENANCE_TOOLTIP.title);
  });

  it("keeps non-AI provenance badges as static chips", () => {
    const html = renderToStaticMarkup(
      <ProvenanceBadge source="customer_provided" />,
    );
    expect(html).toContain("Customer");
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain("type=\"button\"");
  });
});
