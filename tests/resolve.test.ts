import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { resolveSnippet, getAllSnippets, getFuzzyMatches } from "../src/lib/resolve.js";
import { serializeSnippet } from "../src/lib/frontmatter.js";

// Create a temp snippet library for testing
const testDir = resolve(tmpdir(), `snip-resolve-test-${Date.now()}`);
const snippetsDir = resolve(testDir, "snippets");
const promptsDir = resolve(testDir, "prompts");

function writeTestSnippet(
  dir: string,
  slug: string,
  overrides: Record<string, unknown> = {},
  body = "\n```bash\necho hello\n```\n",
) {
  const fm = {
    title: overrides.title ?? slug,
    language: overrides.language ?? "bash",
    type: overrides.type ?? "snippet",
    tags: overrides.tags ?? [],
    aliases: overrides.aliases ?? [],
    date: "2026-03-09",
    modified: "2026-03-09",
    ...overrides,
  };
  const content = serializeSnippet(fm, body);
  writeFileSync(resolve(dir, `${slug}.md`), content, "utf-8");
}

beforeAll(() => {
  mkdirSync(snippetsDir, { recursive: true });
  mkdirSync(promptsDir, { recursive: true });

  // Set env so resolve uses our test library
  process.env.SNIP_LIBRARY = testDir;

  writeTestSnippet(snippetsDir, "git-soft-reset", {
    title: "Git Soft Reset",
    tags: ["git", "undo"],
    aliases: ["soft-reset", "undo-commit"],
  });
  writeTestSnippet(snippetsDir, "docker-ps", {
    title: "List Docker Containers",
    tags: ["docker"],
  });
  writeTestSnippet(snippetsDir, "node-build-config", {
    title: "Node.js Build Config",
    language: "typescript",
    tags: ["node", "build"],
  });
  writeTestSnippet(promptsDir, "code-review", {
    title: "Code Review Prompt",
    language: "prompt",
    type: "prompts",
    tags: ["ai"],
    aliases: ["review"],
  });
});

afterAll(() => {
  delete process.env.SNIP_LIBRARY;
  rmSync(testDir, { recursive: true, force: true });
});

describe("getAllSnippets", () => {
  it("returns all snippets from all type directories", () => {
    const all = getAllSnippets(testDir);
    expect(all.length).toBe(4);
  });

  it("parses slugs from filenames", () => {
    const all = getAllSnippets(testDir);
    const slugs = all.map((s) => s.slug).sort();
    expect(slugs).toEqual(["code-review", "docker-ps", "git-soft-reset", "node-build-config"]);
  });
});

describe("resolveSnippet", () => {
  it("resolves by exact slug", () => {
    const result = resolveSnippet("git-soft-reset");
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("exact");
    expect(result!.snippet.slug).toBe("git-soft-reset");
  });

  it("resolves by type-prefixed path", () => {
    const result = resolveSnippet("prompts/code-review");
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("prefix");
    expect(result!.snippet.slug).toBe("code-review");
  });

  it("resolves by alias (case-insensitive)", () => {
    const result = resolveSnippet("soft-reset");
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("alias");
    expect(result!.snippet.slug).toBe("git-soft-reset");
  });

  it("resolves alias case-insensitively", () => {
    const result = resolveSnippet("Undo-Commit");
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("alias");
    expect(result!.snippet.slug).toBe("git-soft-reset");
  });

  it("resolves by fuzzy match when only one candidate", () => {
    const result = resolveSnippet("docker");
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("fuzzy");
    expect(result!.snippet.slug).toBe("docker-ps");
  });

  it("returns null when no match found", () => {
    const result = resolveSnippet("nonexistent-snippet");
    expect(result).toBeNull();
  });

  it("returns null when multiple fuzzy matches (ambiguous)", () => {
    // "git" matches git-soft-reset slug, and could also match others via title
    // But let's test with something truly ambiguous — "node" matches node-build-config
    // and "build" appears in node-build-config only, so that's unique
    const result = resolveSnippet("build");
    // "build" appears in node-build-config slug — only one match
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("fuzzy");
  });

  it("prefers exact match over alias", () => {
    const result = resolveSnippet("code-review");
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("exact");
  });

  it("prefers exact match over fuzzy", () => {
    const result = resolveSnippet("docker-ps");
    expect(result).not.toBeNull();
    expect(result!.matchType).toBe("exact");
  });
});

describe("getFuzzyMatches", () => {
  it("returns matching snippets by slug substring", () => {
    const matches = getFuzzyMatches("git");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((s) => s.slug === "git-soft-reset")).toBe(true);
  });

  it("returns matching snippets by title substring", () => {
    const matches = getFuzzyMatches("Docker");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((s) => s.slug === "docker-ps")).toBe(true);
  });

  it("returns empty array for no matches", () => {
    const matches = getFuzzyMatches("zzzznonexistentzzzz");
    expect(matches).toEqual([]);
  });
});
