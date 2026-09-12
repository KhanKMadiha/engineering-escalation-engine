import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageSection } from "@/components/layout/PageSection";

describe("Cases dashboard demo notice", () => {
  it("renders a subtle demo environment notice below the page description", () => {
    const html = renderToStaticMarkup(
      <PageSection
        title="Cases"
        description="Open and recent support cases. Review case status, recommendations and escalation progress."
        notice={
          <p className="max-w-2xl text-sm text-slate-500">
            <span className="font-medium text-slate-600">Demo environment</span>
            <span className="text-slate-400"> · </span>
            <span>
              All cases shown are fictional and contain no real customer data.
            </span>
          </p>
        }
      >
        <div>table</div>
      </PageSection>,
    );

    expect(html).toContain("Cases");
    expect(html).toContain(
      "Open and recent support cases. Review case status, recommendations and escalation progress.",
    );
    expect(html).toContain("Demo environment");
    expect(html).toContain(
      "All cases shown are fictional and contain no real customer data.",
    );
    expect(html).not.toMatch(/bg-amber|bg-yellow|Demo environment[\s\S]*banner/i);
  });
});
