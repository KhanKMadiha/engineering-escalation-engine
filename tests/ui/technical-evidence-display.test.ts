import { describe, expect, it } from "vitest";
import {
  formatCompactIssueFirstObserved,
  formatCompactRequestIds,
} from "@/lib/ui/case-display";

describe("Technical Evidence compact metadata display", () => {
  it("strips Partial correlation note wrappers without inventing IDs", () => {
    expect(
      formatCompactRequestIds(
        "Partial correlation note: teams-public-ch-pending",
      ),
    ).toBe("teams-public-ch-pending");
    expect(formatCompactRequestIds("req-1")).toBe("req-1");
    expect(formatCompactRequestIds("  ")).toBe("");
  });

  it("strips First noticed narrative that duplicates the field label", () => {
    expect(
      formatCompactIssueFirstObserved(
        "First noticed on 11 Sep 2026 in public channels",
      ),
    ).toBe("11 Sep 2026");
    expect(
      formatCompactIssueFirstObserved("Around 08:00 on 8 Sep 2026"),
    ).toBe("Around 08:00 on 8 Sep 2026");
    expect(formatCompactIssueFirstObserved("—")).toBe("—");
  });
});
