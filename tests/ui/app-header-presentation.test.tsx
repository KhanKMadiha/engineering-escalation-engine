import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { appContainerClassName } from "@/components/layout/AppContainer";

/**
 * AppHeader remains available for nested use; primary chrome is AppShell.
 */
describe("AppHeader navigation", () => {
  it("shows the product identity linking home", () => {
    const html = renderToStaticMarkup(<AppHeader />);
    expect(html).toContain("Engineering Escalation Engine");
    expect(html).toContain('href="/"');
    expect(html).toContain(appContainerClassName);
  });
});
