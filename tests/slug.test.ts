import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { slugify, uniqueSlug } from "../src/lib/slug.js";

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

describe("uniqueSlug", () => {
  const dir = resolve(tmpdir(), `snip-slug-test-${Date.now()}`);

  beforeAll(() => mkdirSync(dir, { recursive: true }));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("returns base slug when no collision", () => {
    expect(uniqueSlug("My Snippet", dir)).toBe("my-snippet");
  });

  it("appends -2 on first collision", () => {
    writeFileSync(resolve(dir, "my-snippet.md"), "", "utf-8");
    expect(uniqueSlug("My Snippet", dir)).toBe("my-snippet-2");
  });

  it("appends -3 when -2 also exists", () => {
    writeFileSync(resolve(dir, "my-snippet-2.md"), "", "utf-8");
    expect(uniqueSlug("My Snippet", dir)).toBe("my-snippet-3");
  });

  it("keeps incrementing past multiple collisions", () => {
    writeFileSync(resolve(dir, "my-snippet-3.md"), "", "utf-8");
    writeFileSync(resolve(dir, "my-snippet-4.md"), "", "utf-8");
    expect(uniqueSlug("My Snippet", dir)).toBe("my-snippet-5");
  });

  it("handles different titles independently", () => {
    expect(uniqueSlug("Other Title", dir)).toBe("other-title");
  });
});
