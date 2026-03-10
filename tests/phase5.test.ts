import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getLinks,
  getBacklinks,
  findOrphans,
  findUnresolved,
} from "../src/lib/obsidian.js";
import {
  parseSnippetString,
  serializeSnippet,
  createNewFrontmatter,
  writeSnippetFile,
} from "../src/lib/frontmatter.js";

// ---------------------------------------------------------------------------
// Obsidian graph helpers
// ---------------------------------------------------------------------------
describe("getLinks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "snip-links-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("extracts wikilinks from a file", () => {
    const filePath = join(tempDir, "note.md");
    writeFileSync(
      filePath,
      "Some text with [[foo]] and also [[bar]] in it.",
      "utf-8",
    );

    const links = getLinks(filePath);
    expect(links).toEqual(["foo", "bar"]);
  });

  it("returns empty array when no wikilinks exist", () => {
    const filePath = join(tempDir, "plain.md");
    writeFileSync(filePath, "No links here at all.", "utf-8");

    expect(getLinks(filePath)).toEqual([]);
  });

  it("handles multiple links on the same line", () => {
    const filePath = join(tempDir, "multi.md");
    writeFileSync(filePath, "See [[alpha]] and [[beta]] and [[gamma]].", "utf-8");

    expect(getLinks(filePath)).toEqual(["alpha", "beta", "gamma"]);
  });
});

describe("getBacklinks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "snip-backlinks-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds files that link to a given file", () => {
    const fileA = join(tempDir, "file-a.md");
    const fileB = join(tempDir, "file-b.md");

    writeFileSync(fileA, "This links to [[file-b]].", "utf-8");
    writeFileSync(fileB, "No outgoing links.", "utf-8");

    const backlinks = getBacklinks(fileB, tempDir);
    expect(backlinks.length).toBe(1);
    expect(backlinks[0]).toBe(fileA);
  });

  it("does not include the file itself", () => {
    const fileA = join(tempDir, "file-a.md");
    writeFileSync(fileA, "Self-ref [[file-a]].", "utf-8");

    const backlinks = getBacklinks(fileA, tempDir);
    expect(backlinks).toEqual([]);
  });

  it("returns empty when no files link to the target", () => {
    const fileA = join(tempDir, "file-a.md");
    const fileB = join(tempDir, "file-b.md");

    writeFileSync(fileA, "Standalone note.", "utf-8");
    writeFileSync(fileB, "Also standalone.", "utf-8");

    expect(getBacklinks(fileA, tempDir)).toEqual([]);
  });
});

describe("findOrphans", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "snip-orphans-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("identifies files with no links in or out", () => {
    const fileA = join(tempDir, "file-a.md");
    const fileB = join(tempDir, "file-b.md");
    const fileC = join(tempDir, "file-c.md");

    // A links to B — A has outgoing links, B has a backlink
    writeFileSync(fileA, "See [[file-b]] for details.", "utf-8");
    writeFileSync(fileB, "Content here.", "utf-8");
    // C is isolated — no links in or out
    writeFileSync(fileC, "Completely isolated note.", "utf-8");

    const orphans = findOrphans(tempDir);

    // Only C should be an orphan
    expect(orphans.length).toBe(1);
    expect(orphans[0]).toBe(fileC);
  });

  it("returns empty when all files are connected", () => {
    const fileA = join(tempDir, "file-a.md");
    const fileB = join(tempDir, "file-b.md");

    writeFileSync(fileA, "Links to [[file-b]].", "utf-8");
    writeFileSync(fileB, "Links to [[file-a]].", "utf-8");

    expect(findOrphans(tempDir)).toEqual([]);
  });
});

describe("findUnresolved", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "snip-unresolved-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds wikilinks that do not match existing files", () => {
    const fileA = join(tempDir, "file-a.md");
    writeFileSync(fileA, "Links to [[nonexistent]] and [[file-a]].", "utf-8");

    const unresolved = findUnresolved(tempDir);
    expect(unresolved).toContain("nonexistent");
    expect(unresolved).not.toContain("file-a");
  });

  it("returns empty when all links resolve", () => {
    const fileA = join(tempDir, "file-a.md");
    const fileB = join(tempDir, "file-b.md");

    writeFileSync(fileA, "See [[file-b]].", "utf-8");
    writeFileSync(fileB, "See [[file-a]].", "utf-8");

    expect(findUnresolved(tempDir)).toEqual([]);
  });

  it("deduplicates unresolved links", () => {
    const fileA = join(tempDir, "file-a.md");
    const fileB = join(tempDir, "file-b.md");

    writeFileSync(fileA, "See [[missing]].", "utf-8");
    writeFileSync(fileB, "Also [[missing]].", "utf-8");

    const unresolved = findUnresolved(tempDir);
    expect(unresolved.filter((l) => l === "missing").length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Export command logic
// ---------------------------------------------------------------------------
describe("Export JSON format", () => {
  it("produces the expected JSON structure from a snippet", () => {
    const raw = `---
title: JSON Test
tags:
  - export
  - test
language: typescript
type: snippet
date: "2026-03-09"
modified: "2026-03-09"
---

\`\`\`typescript
console.log("hello");
\`\`\`
`;

    const snippet = parseSnippetString(raw, "/tmp/json-test.md");

    // Mirror the export command's JSON mapping
    const exported = {
      slug: snippet.slug,
      title: snippet.frontmatter.title,
      description: snippet.frontmatter.description,
      tags: snippet.frontmatter.tags,
      aliases: snippet.frontmatter.aliases,
      language: snippet.frontmatter.language,
      type: snippet.frontmatter.type,
      date: snippet.frontmatter.date,
      modified: snippet.frontmatter.modified,
      source: snippet.frontmatter.source,
      related: snippet.frontmatter.related,
      content: snippet.body,
    };

    expect(exported.slug).toBe("json-test");
    expect(exported.title).toBe("JSON Test");
    expect(exported.tags).toEqual(["export", "test"]);
    expect(exported.language).toBe("typescript");
    expect(exported.type).toBe("snippet");
    expect(exported.content).toContain('console.log("hello")');

    // Verify it round-trips through JSON.stringify / JSON.parse
    const json = JSON.stringify([exported], null, 2);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].slug).toBe("json-test");
  });
});

describe("Export Markdown format", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "snip-export-md-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes a snippet file and reads it back with frontmatter", () => {
    const filePath = join(tempDir, "md-export-test.md");
    const fm = createNewFrontmatter({
      title: "Markdown Export",
      tags: ["demo"],
      language: "bash",
    });

    writeSnippetFile(filePath, fm, '\n```bash\necho "exported"\n```\n');

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("---");
    expect(content).toContain("title: Markdown Export");
    expect(content).toContain("language: bash");
    expect(content).toContain('echo "exported"');
  });

  it("serializes and re-parses consistently", () => {
    const fm = createNewFrontmatter({
      title: "Round Trip MD",
      tags: ["rt"],
      language: "python",
    });
    const body = '\n```python\nprint("hi")\n```\n';
    const serialized = serializeSnippet(fm, body);

    const reparsed = parseSnippetString(serialized, "/tmp/round-trip-md.md");
    expect(reparsed.frontmatter.title).toBe("Round Trip MD");
    expect(reparsed.frontmatter.tags).toEqual(["rt"]);
    expect(reparsed.frontmatter.language).toBe("python");
    expect(reparsed.body).toContain('print("hi")');
  });
});

// ---------------------------------------------------------------------------
// End-to-end lifecycle (simplified, file-based)
// ---------------------------------------------------------------------------
describe("Snippet lifecycle (file-based)", () => {
  let tempDir: string;
  let snippetsDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "snip-lifecycle-"));
    snippetsDir = join(tempDir, "snippets");
    mkdirSync(snippetsDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("init -> add -> search -> copy -> edit -> rm", () => {
    // --- INIT: directory already created in beforeEach ---

    // --- ADD: create a snippet file ---
    const slug = "lifecycle-test";
    const filePath = join(snippetsDir, `${slug}.md`);
    const fm = createNewFrontmatter({
      title: "Lifecycle Test",
      tags: ["lifecycle", "e2e"],
      language: "bash",
    });

    writeSnippetFile(filePath, fm, '\n```bash\necho "lifecycle"\n```\n');
    expect(readFileSync(filePath, "utf-8")).toContain("title: Lifecycle Test");

    // --- SEARCH: parse and verify the snippet is findable ---
    const content = readFileSync(filePath, "utf-8");
    const snippet = parseSnippetString(content, filePath);
    expect(snippet.slug).toBe("lifecycle-test");
    expect(snippet.frontmatter.tags).toContain("lifecycle");

    // --- COPY: extract code content ---
    expect(snippet.body).toContain('echo "lifecycle"');

    // --- EDIT: update the snippet with new content ---
    writeSnippetFile(
      filePath,
      { ...snippet.frontmatter, tags: ["lifecycle", "e2e", "updated"] },
      '\n```bash\necho "updated lifecycle"\n```\n',
    );

    const edited = parseSnippetString(readFileSync(filePath, "utf-8"), filePath);
    expect(edited.frontmatter.tags).toContain("updated");
    expect(edited.body).toContain('echo "updated lifecycle"');

    // --- RM: delete the file ---
    rmSync(filePath);
    expect(() => readFileSync(filePath, "utf-8")).toThrow();
  });
});
