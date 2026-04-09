import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the quick action shell", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Smart Crowd Navigator");
    expect(markup).toContain("Food");
    expect(markup).toContain("Washroom");
    expect(markup).toContain("Entry Gate");
    expect(markup).toContain("Exit");
    expect(markup).toContain("Live assistant");
  });
});
