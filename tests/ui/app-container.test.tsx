import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppContainer,
  appContainerClassName,
} from "@/components/layout/AppContainer";

describe("AppContainer", () => {
  it("exposes a shared max-width and responsive horizontal padding", () => {
    expect(appContainerClassName).toContain("max-w-7xl");
    expect(appContainerClassName).toContain("px-4");
    expect(appContainerClassName).toContain("sm:px-6");
    expect(appContainerClassName).toContain("mx-auto");
    expect(appContainerClassName).toContain("w-full");

    const html = renderToStaticMarkup(
      <AppContainer>
        <span>content</span>
      </AppContainer>,
    );
    expect(html).toContain(appContainerClassName);
    expect(html).toContain("content");
  });
});
