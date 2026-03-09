import { describe, it, expect } from "vitest";
import { formatAlfredResults, formatAlfredError } from "../src/lib/alfred.js";
import { parseSnippetString } from "../src/lib/frontmatter.js";
import type { Snippet } from "../src/types/index.js";

function makeSnippet(raw: string, path: string): Snippet {
  return parseSnippetString(raw, path);
}

describe("formatAlfredResults", () => {
  it("formats snippets as Alfred Script Filter JSON", () => {
    const snippet = makeSnippet(
      `---
title: Test Snippet
tags:
  - python
  - api
language: python
type: snippet
---
\`\`\`python
print("hello")
\`\`\``,
      "/lib/snippets/test-snippet.md",
    );

    const result = formatAlfredResults([snippet]);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.uid).toBe("snippet/test-snippet");
    expect(item.title).toBe("Test Snippet");
    expect(item.subtitle).toContain("python");
    expect(item.subtitle).toContain("tags:");
    expect(item.arg).toBe('print("hello")');
    expect(item.mods.cmd.arg).toBe('print("hello")');
    expect(item.mods.alt.arg).toBe("/lib/snippets/test-snippet.md");
    expect(item.mods.ctrl.arg).toBe("/lib/snippets/test-snippet.md");
    expect(item.text.copy).toBe('print("hello")');
    expect(item.variables.snippet_slug).toBe("test-snippet");
    expect(item.variables.snippet_type).toBe("snippet");
  });

  it("returns empty items array for no snippets", () => {
    const result = formatAlfredResults([]);
    expect(result.items).toEqual([]);
  });

  it("uses slug as title when title is empty", () => {
    const snippet = makeSnippet(
      `---
type: snippet
---
Some content`,
      "/lib/snippets/my-slug.md",
    );

    const result = formatAlfredResults([snippet]);
    expect(result.items[0].title).toBe("my-slug");
  });
});

describe("formatAlfredError", () => {
  it("returns a single error item", () => {
    const result = formatAlfredError("Something went wrong");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Error");
    expect(result.items[0].subtitle).toBe("Something went wrong");
  });
});
