import type { SnippetFrontmatter } from "../types/index.js";
import { callLlm, isLlmAvailable, setProviderOverride, setDebugMode } from "./providers/index.js";

// Re-export for backwards compatibility
export { callLlm, isLlmAvailable, setProviderOverride, setDebugMode };

/** @deprecated Use isLlmAvailable() instead */
export async function isOllamaAvailable(): Promise<boolean> {
  return isLlmAvailable();
}

const VALID_LANGUAGES = [
  "python", "javascript", "typescript", "bash", "sh", "zsh",
  "ruby", "go", "rust", "java", "kotlin", "swift", "c", "cpp",
  "csharp", "php", "perl", "lua", "r", "sql", "html", "css",
  "json", "yaml", "toml", "xml", "markdown", "prompt", "unknown",
];

export async function detectLanguage(code: string): Promise<string | null> {
  const prompt = `Identify the programming language of this code. Respond with ONLY the language name in lowercase (e.g., "python", "bash", "javascript"). If it's a natural language prompt or instruction, respond with "prompt". If unsure, respond with "unknown".

Code:
---
${code.slice(0, 500)}`;

  const result = await callLlm(prompt);
  if (!result) return null;

  const cleaned = result.toLowerCase().replace(/[^a-z+#]/g, "").trim();
  if (VALID_LANGUAGES.includes(cleaned)) return cleaned;

  for (const lang of VALID_LANGUAGES) {
    if (result.toLowerCase().includes(lang)) return lang;
  }

  return null;
}

export async function suggestTags(
  content: string,
  existingTags: string[] = [],
): Promise<string[]> {
  const existingStr = existingTags.length
    ? `\nExisting tags in the library: ${existingTags.join(", ")}`
    : "";

  const prompt = `Suggest 2-5 short, relevant tags for this code snippet. Tags should be lowercase, single words or hyphenated.${existingStr}

Respond with ONLY a comma-separated list of tags, nothing else.

Content:
---
${content.slice(0, 1000)}`;

  const result = await callLlm(prompt);
  if (!result) return [];

  return result
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter((t) => t.length > 0 && t.length < 30);
}

export async function generateTitle(content: string): Promise<string | null> {
  const prompt = `Generate a short, descriptive title (3-7 words) for this code snippet. Respond with ONLY the title, nothing else.

Content:
---
${content.slice(0, 1000)}`;

  const result = await callLlm(prompt);
  if (!result) return null;

  return result
    .replace(/^["']|["']$/g, "")
    .replace(/\.+$/, "")
    .trim()
    .slice(0, 80);
}

/**
 * Enrich a snippet's frontmatter in a SINGLE LLM call.
 * Builds a prompt requesting only the missing fields and expects a JSON response.
 */
export async function enrichSnippet(
  frontmatter: SnippetFrontmatter,
  content: string,
): Promise<Partial<SnippetFrontmatter>> {
  if (!(await isLlmAvailable())) return {};

  // Determine which fields need generating
  const needs: string[] = [];
  if (!frontmatter.title || frontmatter.title.startsWith("untitled-")) needs.push("title");
  if (!frontmatter.description) needs.push("description");
  if (!frontmatter.language) needs.push("language");
  if (frontmatter.tags.length === 0) needs.push("tags");
  if (frontmatter.aliases.length === 0) needs.push("aliases");

  if (needs.length === 0) return {};

  // Build field instructions
  const fieldInstructions: string[] = [];
  const exampleJson: Record<string, unknown> = {};

  if (needs.includes("title")) {
    fieldInstructions.push('- "title": A short descriptive title, 3-7 words');
    exampleJson.title = "Fetch API Error Handler";
  }
  if (needs.includes("description")) {
    fieldInstructions.push('- "description": One-line description, under 100 characters');
    exampleJson.description = "Wraps fetch with retry logic and error handling";
  }
  if (needs.includes("language")) {
    fieldInstructions.push(`- "language": Programming language in lowercase (one of: ${VALID_LANGUAGES.slice(0, 10).join(", ")}, etc). Use "prompt" for natural language instructions`);
    exampleJson.language = "javascript";
  }
  if (needs.includes("tags")) {
    fieldInstructions.push('- "tags": Array of 2-5 lowercase tags, single words or hyphenated');
    exampleJson.tags = ["fetch", "error-handling", "async"];
  }
  if (needs.includes("aliases")) {
    fieldInstructions.push('- "aliases": Array of 2-4 alternative search terms (not the title)');
    exampleJson.aliases = ["http request", "api call", "fetch wrapper"];
  }

  const prompt = `Analyze this code snippet and return a JSON object with the following fields:

${fieldInstructions.join("\n")}

Respond with ONLY valid JSON, no markdown fences, no explanation. Example response format:
${JSON.stringify(exampleJson)}

Content:
---
${content.slice(0, 1500)}`;

  const result = await callLlm(prompt);
  if (!result) return {};

  // Extract JSON from response (handle markdown fences, extra text)
  const parsed = parseJsonResponse(result);
  if (!parsed) return {};

  // Validate and build updates
  const updates: Partial<SnippetFrontmatter> = {};

  if (needs.includes("title") && typeof parsed.title === "string" && parsed.title.length > 0) {
    updates.title = parsed.title.replace(/^["']|["']$/g, "").replace(/\.+$/, "").trim().slice(0, 80);
  }
  if (needs.includes("description") && typeof parsed.description === "string" && parsed.description.length > 0) {
    updates.description = parsed.description.replace(/\.+$/, "").trim().slice(0, 100);
  }
  if (needs.includes("language") && typeof parsed.language === "string") {
    const lang = parsed.language.toLowerCase().replace(/[^a-z+#]/g, "").trim();
    if (VALID_LANGUAGES.includes(lang) && lang !== "unknown") {
      updates.language = lang;
    }
  }
  if (needs.includes("tags") && Array.isArray(parsed.tags)) {
    const tags = parsed.tags
      .map((t: unknown) => String(t).trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
      .filter((t: string) => t.length > 0 && t.length < 30);
    if (tags.length > 0) updates.tags = tags;
  }
  if (needs.includes("aliases") && Array.isArray(parsed.aliases)) {
    const aliases = parsed.aliases
      .map((a: unknown) => String(a).trim().toLowerCase().replace(/[^a-z0-9 -]/g, ""))
      .filter((a: string) => a.length > 0 && a.length < 50);
    if (aliases.length > 0) updates.aliases = aliases;
  }

  return updates;
}

function parseJsonResponse(text: string): Record<string, unknown> | null {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");

  // Try to find JSON object in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
