import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseQueueClient } from "@/components/cases/CaseQueueClient";

describe("Cases dashboard demo notice", () => {
  it("renders demo notice and real-data summary cards", () => {
    const html = renderToStaticMarkup(<CaseQueueClient cases={[]} />);

    expect(html).toContain("Case queue");
    expect(html).not.toContain("Demo environment");
    expect(html).not.toContain(
      "All cases shown are fictional and contain no real customer data.",
    );
    expect(html).toContain("Awaiting review");
    expect(html).toContain("Ready for handoff");
    expect(html).toContain("In progress");
    expect(html).toContain("New case");
    expect(html).not.toMatch(/bg-amber|bg-yellow|Demo environment[\s\S]*banner/i);
  });
});

