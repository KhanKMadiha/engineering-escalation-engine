import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { AppShell } from "@/components/layout/AppShell";

describe("AppShell", () => {
  it("renders light sidebar with workspace, operations and resources nav", () => {
    const html = renderToStaticMarkup(
      <AppShell pendingReviewsCount={1} handoffsCount={1}>
        <div>page-content</div>
      </AppShell>,
    );
    expect(html).toContain("Escalation Engine");
    expect(html).toContain("Support Operations");
    expect(html).toContain("Workspace");
    expect(html).toContain("Case queue");
    expect(html).toContain("New case");
    expect(html).toContain("Operations");
    expect(html).toContain("Pending reviews");
    expect(html).toContain("Handoffs");
    expect(html).toContain("Activity");
    expect(html).toContain("Resources");
    expect(html).toContain("How it works");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/cases/new"');
    expect(html).toContain('href="/pending-reviews"');
    expect(html).toContain('href="/handoffs"');
    expect(html).toContain('href="/activity"');
    expect(html).toContain('href="/how-it-works"');
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain("page-content");
    expect(html).toContain("Demo");
    expect(html).toContain("Fictional cases. No real customer data.");
    expect(html).not.toContain("Demo workspace");
    expect(html).not.toContain(
      'aria-label="Demo workspace. Fictional cases. No real customer data."',
    );
    expect(html).toContain("Menu");
    expect(html).toContain("bg-sidebar");
    expect(html).toContain("bg-sidebar-active");
    expect(html).toContain("1 items");
  });
});
