// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  applyTextSize,
  initialTextSize,
  nextTextSize,
} from "../../src/app/text-size.ts";

describe("text size", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-text-size");
  });

  it("starts at medium", () => {
    expect(initialTextSize()).toBe("medium");
  });

  it("remembers the last choice, and lets a query param win", () => {
    applyTextSize("large");
    expect(initialTextSize()).toBe("large");
    expect(initialTextSize("small")).toBe("small");
    // Anything else is not a size.
    expect(initialTextSize("huge")).toBe("large");
  });

  it("cycles small → medium → large → small", () => {
    expect(nextTextSize("small")).toBe("medium");
    expect(nextTextSize("medium")).toBe("large");
    expect(nextTextSize("large")).toBe("small");
  });

  it("paints the root element", () => {
    applyTextSize("small");
    expect(document.documentElement.getAttribute("data-text-size")).toBe(
      "small",
    );
  });
});
