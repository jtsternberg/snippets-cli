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
    expect(item.icon).toEqual({ type: "filetype", path: ".py" });
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

  it("uses fileicon fallback when language has no known extension", () => {
    const snippet = makeSnippet(
      `---
type: snippet
language: cobol
---
IDENTIFICATION DIVISION.`,
      "/lib/snippets/old.md",
    );

    const result = formatAlfredResults([snippet]);
    expect(result.items[0].icon).toEqual({ type: "fileicon", path: "/lib/snippets/old.md" });
  });

  it("uses fileicon fallback when no language is set", () => {
    const snippet = makeSnippet(
      `---
type: snippet
---
plain text`,
      "/lib/snippets/notes.md",
    );

    const result = formatAlfredResults([snippet]);
    expect(result.items[0].icon).toEqual({ type: "fileicon", path: "/lib/snippets/notes.md" });
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
