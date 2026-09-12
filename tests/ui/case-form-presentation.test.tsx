import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseForm } from "@/components/cases/CaseForm";

describe("new support case form presentation", () => {
  it("groups fields in Support Ops intake order with approximate first-observed field", () => {
    const html = renderToStaticMarkup(<CaseForm />);

    expect(html).toContain("Customer and impact");
    expect(html).toContain("Who reported the issue and what is affected.");
    expect(html).toContain("Issue details");
    expect(html).toContain("Investigation and evidence");
    expect(html).toContain(
      "Capture troubleshooting performed and the technical evidence available.",
    );

    expect(html).toContain("Affected customer count");
    expect(html).toContain('name="affectedCustomerCount"');
    expect(html).toContain("Issue first observed");
    expect(html).toContain("(optional)");
    expect(html).toContain('name="issueFirstObserved"');
    expect(html).toContain('type="text"');
    expect(html).toContain(
      "Approximate timeframe is fine. Leave blank if unknown.",
    );
    expect(html).not.toContain('name="incidentTimestamp"');
    expect(html).not.toContain('type="datetime-local"');
    expect(html).toContain("Request / correlation IDs");
    expect(html).toContain('name="requestIds"');

    expect(html).toContain("Create case");
    expect(html).toContain("Cancel");

    // Visual section copy should not use the old labels as section titles
    expect(html).not.toContain("Customer and product");
    expect(html).not.toContain(">Incident timestamp<");

    // Customer and impact appears before issue details, which precedes investigation
    const impact = html.indexOf("Customer and impact");
    const details = html.indexOf("Issue details");
    const evidence = html.indexOf("Investigation and evidence");
    expect(impact).toBeGreaterThan(-1);
    expect(details).toBeGreaterThan(impact);
    expect(evidence).toBeGreaterThan(details);

    // Affected customer count / issue first observed live in the first section markup
    const affected = html.indexOf("Affected customer count");
    expect(affected).toBeGreaterThan(impact);
    expect(affected).toBeLessThan(details);
    const observed = html.indexOf("Issue first observed");
    expect(observed).toBeGreaterThan(impact);
    expect(observed).toBeLessThan(details);
  });
});
