import { describe, it, expect } from "vitest";
import { slugify } from "../src/lib/slug.js";

describe("slugify", () => {
  it("converts title to kebab-case", () => {
    expect(slugify("Extract JSON from API Response")).toBe(
      "extract-json-from-api-response",
    );
  });

  it("removes special characters", () => {
    expect(slugify("Hello, World! (Test)")).toBe("hello-world-test");
  });

  it("collapses multiple dashes", () => {
    expect(slugify("foo---bar")).toBe("foo-bar");
  });

  it("strips leading and trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("handles numbers", () => {
    expect(slugify("Step 1: Do Something")).toBe("step-1-do-something");
  });

  it("truncates to 100 characters", () => {
    const long = "a".repeat(150);
    expect(slugify(long).length).toBeLessThanOrEqual(100);
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});
