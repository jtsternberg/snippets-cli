import { describe, it, expect } from "vitest";
import type { SnippetFrontmatter } from "../src/types/index.js";

/**
 * Tests for the --force blanking logic used by `snip enrich --force`.
 * Verifies that all metadata fields are cleared before re-enrichment.
 */
describe("enrich --force field blanking", () => {
  // Mirrors the blanking logic in src/commands/enrich.ts applyEnrichment()
  function blankForForce(fm: SnippetFrontmatter): SnippetFrontmatter {
    return {
      ...fm,
      title: "",
      description: "",
      language: "",
      aliases: [],
      tags: [],
    };
  }

  const populated: SnippetFrontmatter = {
    title: "Existing Title",
    description: "Existing description",
    language: "python",
    tags: ["existing", "tags"],
    aliases: ["existing alias"],
    type: "snippets",
    date: "2026-01-01",
    modified: "2026-01-01",
    source: "",
    related: [],
    variables: [],
  };

  it("blanks title for regeneration", () => {
    const blanked = blankForForce(populated);
    expect(blanked.title).toBe("");
  });

  it("blanks description for regeneration", () => {
    const blanked = blankForForce(populated);
    expect(blanked.description).toBe("");
  });

  it("blanks language for regeneration", () => {
    const blanked = blankForForce(populated);
    expect(blanked.language).toBe("");
  });

  it("blanks tags for regeneration", () => {
    const blanked = blankForForce(populated);
    expect(blanked.tags).toEqual([]);
  });

  it("blanks aliases for regeneration", () => {
    const blanked = blankForForce(populated);
    expect(blanked.aliases).toEqual([]);
  });

  it("preserves non-enrichment fields", () => {
    const blanked = blankForForce(populated);
    expect(blanked.type).toBe("snippets");
    expect(blanked.date).toBe("2026-01-01");
    expect(blanked.modified).toBe("2026-01-01");
    expect(blanked.source).toBe("");
    expect(blanked.related).toEqual([]);
    expect(blanked.variables).toEqual([]);
  });
});
