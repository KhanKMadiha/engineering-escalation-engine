import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { appContainerClassName } from "@/components/layout/AppContainer";

describe("AppHeader navigation", () => {
  it("shows only the product identity linking home, with no Cases nav item", () => {
    const html = renderToStaticMarkup(<AppHeader />);
    expect(html).toContain("Engineering Escalation Engine");
    expect(html).toContain('href="/"');
    expect(html).toContain(appContainerClassName);
    expect(html).toContain("text-lg");
    expect(html).toContain("font-semibold");
    expect(html).toContain("text-slate-900");
    expect(html).not.toContain(">Cases<");
    expect(html).not.toContain("Dashboard");
    expect(html).not.toContain(">New case<");
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain('role="navigation"');
    expect(html).not.toContain("Primary");
  });
});
