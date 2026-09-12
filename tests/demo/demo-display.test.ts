import { describe, expect, it } from "vitest";
import {
  DEMO_CASE_MARKER,
  DEMO_DESCRIPTION_NOTICE,
  stripDemoDescriptionBoilerplate,
  stripDemoMarkerPrefix,
  stripDemoMarkersForDisplay,
} from "@/lib/demo/demo-cases";

describe("demo display helpers", () => {
  it("strips leading demo markers for presentation", () => {
    expect(
      stripDemoMarkerPrefix(`${DEMO_CASE_MARKER} Northstar Financial`),
    ).toBe("Northstar Financial");
  });

  it("removes description boilerplate without touching case evidence", () => {
    const withNotice = [
      DEMO_DESCRIPTION_NOTICE,
      "",
      "Multiple customers report intermittent HTTP 500 responses.",
    ].join("\n");
    expect(stripDemoDescriptionBoilerplate(withNotice)).toBe(
      "Multiple customers report intermittent HTTP 500 responses.",
    );
  });

  it("strips embedded demo markers from handoff-style summaries", () => {
    expect(
      stripDemoMarkersForDisplay(
        `${DEMO_CASE_MARKER} Intermittent 500 (${DEMO_CASE_MARKER} Northstar Financial)`,
      ),
    ).toBe("Intermittent 500 (Northstar Financial)");
  });
});
