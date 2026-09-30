import { describe, it, expect } from "vitest";
import { textSearch } from "../src/lib/text-search.js";
import type { Snippet } from "../src/types/index.js";

function snip(slug: string, fm: Partial<Snippet["frontmatter"]>, body = ""): Snippet {
  return {
    slug,
    body,
    content: body,
    filePath: `/lib/snippets/${slug}.md`,
    frontmatter: {
      title: slug, description: "", tags: [], aliases: [], language: "", type: "snippets",
      date: "", modified: "", source: "", related: [], variables: [], gist_id: "", gist_updated: "",
      ...fm,
    },
  };
}

describe("textSearch", () => {
  const lib = [
    snip("mentions-git", { title: "Deploy script" }, "git push origin main"),
    snip("git-rebase", { title: "Git rebase onto main", tags: ["git"] }),
    snip("unrelated", { title: "Docker prune" }, "docker system prune"),
  ];

  it("ranks metadata matches above body matches", () => {
    expect(textSearch(lib, "git").map((s) => s.slug)).toEqual(["git-rebase", "mentions-git"]);
  });

  it("requires all terms but not adjacency", () => {
    expect(textSearch(lib, "main rebase").map((s) => s.slug)).toEqual(["git-rebase"]);
  });

  it("is case-insensitive and matches tags, aliases, and description", () => {
    const extra = [snip("x", { aliases: ["Cleanup"], description: "Frees DISK space" })];
    expect(textSearch(extra, "cleanup disk")).toHaveLength(1);
  });

  it("returns nothing for empty or unmatched queries", () => {
    expect(textSearch(lib, "   ")).toEqual([]);
    expect(textSearch(lib, "zzz")).toEqual([]);
  });
});
