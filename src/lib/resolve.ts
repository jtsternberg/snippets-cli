import { readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseSnippetFile } from "./frontmatter.js";
import { getLibraryPath, loadConfig } from "./config.js";
import type { Snippet, ResolveResult } from "../types/index.js";

export function getAllSnippets(libraryPath?: string): Snippet[] {
  const libPath = libraryPath || getLibraryPath();
  const config = loadConfig();
  const snippets: Snippet[] = [];

  for (const type of config.types) {
    const typeDir = resolve(libPath, type);
    if (!existsSync(typeDir)) continue;

    const files = readdirSync(typeDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = join(typeDir, file);
      try {
        snippets.push(parseSnippetFile(filePath));
      } catch {
        // Skip unparseable files
      }
    }
  }

  return snippets;
}

export function resolveSnippet(name: string): ResolveResult | null {
  const libPath = getLibraryPath();
  const config = loadConfig();

  const resolvedLibPath = resolve(libPath);

  // 1. Type-prefixed match: "prompts/code-review"
  if (name.includes("/")) {
    const filePath = resolve(libPath, `${name}.md`);
    if (filePath.startsWith(resolvedLibPath + "/") && existsSync(filePath)) {
      return {
        snippet: parseSnippetFile(filePath),
        matchType: "prefix",
      };
    }
  }

  // 2. Exact slug match across all type directories
  for (const type of config.types) {
    const filePath = resolve(libPath, type, `${name}.md`);
    if (filePath.startsWith(resolvedLibPath + "/") && existsSync(filePath)) {
      return {
        snippet: parseSnippetFile(filePath),
        matchType: "exact",
      };
    }
  }

  // 3. Alias match
  const allSnippets = getAllSnippets(libPath);
  const aliasMatch = allSnippets.find((s) =>
    s.frontmatter.aliases.some(
      (a) => a.toLowerCase() === name.toLowerCase(),
    ),
  );
  if (aliasMatch) {
    return { snippet: aliasMatch, matchType: "alias" };
  }

  // 4. Fuzzy match — find candidates whose slug contains the search term
  const fuzzyMatches = allSnippets.filter(
    (s) =>
      s.slug.includes(name.toLowerCase()) ||
      s.frontmatter.title.toLowerCase().includes(name.toLowerCase()),
  );

  if (fuzzyMatches.length === 1) {
    return { snippet: fuzzyMatches[0], matchType: "fuzzy" };
  }

  return null;
}

export function getFuzzyMatches(name: string): Snippet[] {
  const allSnippets = getAllSnippets();
  return allSnippets.filter(
    (s) =>
      s.slug.includes(name.toLowerCase()) ||
      s.frontmatter.title.toLowerCase().includes(name.toLowerCase()),
  );
}
