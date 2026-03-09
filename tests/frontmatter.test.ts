import { describe, it, expect } from "vitest";
import {
  parseSnippetString,
  serializeSnippet,
  extractCodeBlocks,
  extractCopyContent,
  createNewFrontmatter,
} from "../src/lib/frontmatter.js";

describe("parseSnippetString", () => {
  it("parses basic frontmatter and content", () => {
    const raw = `---
title: Test Snippet
tags:
  - python
  - api
language: python
type: snippet
date: "2026-03-09"
modified: "2026-03-09"
---

\`\`\`python
print("hello")
\`\`\`
`;

    const result = parseSnippetString(raw, "/test/snippets/test-snippet.md");

    expect(result.frontmatter.title).toBe("Test Snippet");
    expect(result.frontmatter.tags).toEqual(["python", "api"]);
    expect(result.frontmatter.language).toBe("python");
    expect(result.frontmatter.type).toBe("snippet");
    expect(result.slug).toBe("test-snippet");
    expect(result.filePath).toBe("/test/snippets/test-snippet.md");
  });

  it("handles missing optional fields with defaults", () => {
    const raw = `---
title: Minimal
---
Some content`;

    const result = parseSnippetString(raw, "/test/minimal.md");

    expect(result.frontmatter.tags).toEqual([]);
    expect(result.frontmatter.aliases).toEqual([]);
    expect(result.frontmatter.related).toEqual([]);
    expect(result.frontmatter.language).toBe("");
    expect(result.frontmatter.type).toBe("snippet");
  });

  it("handles related wikilinks", () => {
    const raw = `---
title: With Links
related:
  - "[[other-snippet]]"
  - "[[another-one]]"
---
Content`;

    const result = parseSnippetString(raw, "/test/with-links.md");
    expect(result.frontmatter.related).toEqual([
      "[[other-snippet]]",
      "[[another-one]]",
    ]);
  });
});

describe("serializeSnippet", () => {
  it("round-trips frontmatter correctly", () => {
    const original = `---
title: Round Trip
tags:
  - test
language: bash
type: snippet
date: '2026-03-09'
modified: '2026-03-09'
---
\`\`\`bash
echo "hello"
\`\`\`
`;

    const parsed = parseSnippetString(original, "/test/round-trip.md");
    const serialized = serializeSnippet(parsed.frontmatter, parsed.content);

    // Re-parse the serialized content
    const reparsed = parseSnippetString(serialized, "/test/round-trip.md");

    expect(reparsed.frontmatter.title).toBe(parsed.frontmatter.title);
    expect(reparsed.frontmatter.tags).toEqual(parsed.frontmatter.tags);
    expect(reparsed.frontmatter.language).toBe(parsed.frontmatter.language);
  });

  it("omits empty fields", () => {
    const serialized = serializeSnippet(
      { title: "Clean", type: "snippet", tags: [], aliases: [] },
      "\nContent\n",
    );

    expect(serialized).toContain("title: Clean");
    expect(serialized).toContain("type: snippet");
    expect(serialized).not.toContain("tags:");
    expect(serialized).not.toContain("aliases:");
  });
});

describe("extractCodeBlocks", () => {
  it("extracts a single code block", () => {
    const content = `
Some text

\`\`\`python
print("hello")
\`\`\`
`;

    const blocks = extractCodeBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("python");
    expect(blocks[0].code).toBe('print("hello")');
  });

  it("extracts multiple code blocks", () => {
    const content = `
\`\`\`bash
echo "hello"
\`\`\`

\`\`\`python
print("hello")
\`\`\`
`;

    const blocks = extractCodeBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe("bash");
    expect(blocks[1].language).toBe("python");
  });

  it("handles code block without language", () => {
    const content = `\`\`\`
some code
\`\`\``;

    const blocks = extractCodeBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("");
  });

  it("returns empty array for no code blocks", () => {
    const blocks = extractCodeBlocks("Just plain text\nNo code blocks here.");
    expect(blocks).toHaveLength(0);
  });
});

describe("extractCopyContent", () => {
  it("extracts single code block content without fences", () => {
    const snippet = parseSnippetString(
      `---
title: Test
---
\`\`\`python
print("hello")
\`\`\``,
      "/test.md",
    );

    expect(extractCopyContent(snippet)).toBe('print("hello")');
  });

  it("concatenates multiple blocks with blank lines", () => {
    const snippet = parseSnippetString(
      `---
title: Multi
---
\`\`\`bash
echo "hello"
\`\`\`

\`\`\`python
print("hello")
\`\`\``,
      "/test.md",
    );

    expect(extractCopyContent(snippet)).toBe(
      'echo "hello"\n\nprint("hello")',
    );
  });

  it("returns full body when no code blocks", () => {
    const snippet = parseSnippetString(
      `---
title: No Code
---
Just some notes without code blocks.`,
      "/test.md",
    );

    expect(extractCopyContent(snippet)).toBe(
      "Just some notes without code blocks.",
    );
  });
});

describe("createNewFrontmatter", () => {
  it("sets date and modified to today", () => {
    const fm = createNewFrontmatter({ title: "New" });
    const today = new Date().toISOString().slice(0, 10);

    expect(fm.date).toBe(today);
    expect(fm.modified).toBe(today);
    expect(fm.title).toBe("New");
    expect(fm.type).toBe("snippet");
  });

  it("allows overriding defaults", () => {
    const fm = createNewFrontmatter({
      title: "Custom",
      type: "prompt",
      tags: ["ai"],
    });

    expect(fm.type).toBe("prompt");
    expect(fm.tags).toEqual(["ai"]);
  });
});
