import type { Snippet } from "../types/index.js";

// Metadata hits outrank body hits so a snippet titled "git rebase" beats one
// that merely mentions git in its code.
const FIELD_WEIGHTS = {
  slug: 10,
  title: 10,
  alias: 8,
  tag: 6,
  description: 4,
  language: 3,
  body: 1,
} as const;

/**
 * Ranked in-process keyword search. Every whitespace-separated term must match
 * somewhere (AND), so "git rebase" doesn't require the words to be adjacent.
 */
export function textSearch(snippets: Snippet[], query: string): Snippet[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const phrase = terms.join(" ");

  const scored: { snippet: Snippet; score: number }[] = [];

  for (const s of snippets) {
    const fm = s.frontmatter;
    const fields: [number, string][] = [
      [FIELD_WEIGHTS.slug, s.slug],
      [FIELD_WEIGHTS.title, fm.title ?? ""],
      [FIELD_WEIGHTS.alias, (fm.aliases ?? []).join(" ")],
      [FIELD_WEIGHTS.tag, (fm.tags ?? []).join(" ")],
      [FIELD_WEIGHTS.description, fm.description ?? ""],
      [FIELD_WEIGHTS.language, fm.language ?? ""],
      [FIELD_WEIGHTS.body, s.body],
    ].map(([w, text]) => [w as number, String(text).toLowerCase()]);

    let score = 0;
    let allMatched = true;
    for (const term of terms) {
      let termScore = 0;
      for (const [weight, text] of fields) {
        if (text.includes(term)) termScore += weight;
      }
      if (termScore === 0) {
        allMatched = false;
        break;
      }
      score += termScore;
    }
    if (!allMatched) continue;

    if (terms.length > 1) {
      for (const [weight, text] of fields) {
        if (text.includes(phrase)) score += weight;
      }
    }

    scored.push({ snippet: s, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.snippet.slug.localeCompare(b.snippet.slug))
    .map((r) => r.snippet);
}
