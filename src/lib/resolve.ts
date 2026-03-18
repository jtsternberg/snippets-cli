import { readdirSync, existsSync } from "node:fs";
import { resolve, join, relative, basename, dirname, isAbsolute } from "node:path";
import { parseSnippetFile } from "./frontmatter.js";
import { getLibraryPath, loadConfig } from "./config.js";
import type { Snippet, ResolveResult, AmbiguousResult } from "../types/index.js";
import { EXIT_CODES } from "../types/index.js";

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

/** Check if filePath is safely inside parentDir (cross-platform). */
function isInsideDir(parentDir: string, filePath: string): boolean {
  const rel = relative(parentDir, filePath);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

export function resolveSnippet(name: string): ResolveResult | AmbiguousResult | null {
  const libPath = getLibraryPath();
  const config = loadConfig();

  const resolvedLibPath = resolve(libPath);

  // 1. Type-prefixed match: "prompts/code-review" — always unambiguous
  if (name.includes("/")) {
    const filePath = resolve(libPath, `${name}.md`);
    if (isInsideDir(resolvedLibPath, filePath) && existsSync(filePath)) {
      return {
        snippet: parseSnippetFile(filePath),
        matchType: "prefix",
      };
    }
  }

  // 2. Exact slug match across ALL type directories (collect, don't short-circuit)
  const exactMatches: Snippet[] = [];
  for (const type of config.types) {
    const filePath = resolve(libPath, type, `${name}.md`);
    if (isInsideDir(resolvedLibPath, filePath) && existsSync(filePath)) {
      exactMatches.push(parseSnippetFile(filePath));
    }
  }
  if (exactMatches.length === 1) {
    return { snippet: exactMatches[0], matchType: "exact" };
  }
  if (exactMatches.length > 1) {
    return { snippets: exactMatches, matchType: "ambiguous" };
  }

  // 3. Alias match (collect all — same alias on multiple snippets is ambiguous)
  const allSnippets = getAllSnippets(libPath);
  const aliasMatches = allSnippets.filter((s) =>
    s.frontmatter.aliases.some(
      (a) => a.toLowerCase() === name.toLowerCase(),
    ),
  );
  if (aliasMatches.length === 1) {
    return { snippet: aliasMatches[0], matchType: "alias" };
  }
  if (aliasMatches.length > 1) {
    return { snippets: aliasMatches, matchType: "ambiguous" };
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

/**
 * Get the type-prefixed path for a snippet, e.g. "prompts/code-review".
 * Derived from the filePath by extracting the parent directory name + slug.
 */
export function getSnippetPrefix(snippet: Snippet): string {
  const typeDir = basename(dirname(snippet.filePath));
  return `${typeDir}/${snippet.slug}`;
}

/**
 * Resolve a snippet, auto-picking the first match when ambiguous.
 * Use this for non-destructive commands (show, copy, etc.) where
 * silently picking one is acceptable.
 */
export function resolveSnippetLoose(name: string): ResolveResult | null {
  const result = resolveSnippet(name);
  if (result?.matchType === "ambiguous") {
    return { snippet: result.snippets[0], matchType: "picked" };
  }
  return result;
}

/**
 * If the result is ambiguous, print disambiguation suggestions and exit.
 * Uses TypeScript assertion to narrow the union for callers.
 */
export function exitIfAmbiguous(
  result: ResolveResult | AmbiguousResult | null,
  name: string,
  command: string,
  argsSuffix?: string,
): asserts result is ResolveResult | null {
  if (result && result.matchType === "ambiguous") {
    console.error(`Multiple snippets match "${name}". Use the full path:`);
    for (const s of result.snippets) {
      const suffix = argsSuffix ? ` ${argsSuffix}` : "";
      console.error(`  snip ${command} ${getSnippetPrefix(s)}${suffix}`);
    }
    process.exit(EXIT_CODES.NOT_FOUND);
  }
}

export function getFuzzyMatches(name: string): Snippet[] {
  const allSnippets = getAllSnippets();
  return allSnippets.filter(
    (s) =>
      s.slug.includes(name.toLowerCase()) ||
      s.frontmatter.title.toLowerCase().includes(name.toLowerCase()),
  );
}
