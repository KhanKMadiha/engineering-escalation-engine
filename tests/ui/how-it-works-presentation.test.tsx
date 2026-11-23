import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HowItWorksPage from "@/app/how-it-works/page";
import { ESCALATION_THRESHOLDS } from "@/lib/escalation/escalation-rules";

describe("How it works presentation", () => {
  it("presents five workflow stages, principles and deterministic score disclosure", () => {
    const html = renderToStaticMarkup(<HowItWorksPage />);

    expect(html).toContain("How it works");
    expect(html).toContain(
      "From investigation to an evidence-based Engineering handoff.",
    );
    expect(html).toContain("Case details");
    expect(html).toContain("Investigation");
    expect(html).toContain("Assessment");
    expect(html).toContain("Escalation approval");
    expect(html).toContain("Create escalation");
    expect(html).toContain("Evidence first");
    expect(html).toContain("Human judgement");
    expect(html).toContain("Clear handoffs");
    expect(html).toContain("How the readiness score works");
    expect(html).toContain(`${ESCALATION_THRESHOLDS.escalateMin}–100`);
    expect(html).toContain("simulated");
    expect(html).not.toContain("Case intake and ticket import");
    expect(html).not.toContain("Audit history");
  });
});
