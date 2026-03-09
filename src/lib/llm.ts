import { loadConfig } from "./config.js";
import type { SnippetFrontmatter } from "../types/index.js";

export interface LlmResponse {
  text: string;
}

export async function isOllamaAvailable(): Promise<boolean> {
  const config = loadConfig();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${config.llm.ollamaHost}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

async function ollamaGenerate(prompt: string, model?: string): Promise<string | null> {
  const config = loadConfig();
  const modelName = model || config.llm.ollamaModel;

  try {
    const resp = await fetch(`${config.llm.ollamaHost}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (!resp.ok) return null;
    const data = (await resp.json()) as { response: string };
    return data.response?.trim() || null;
  } catch {
    return null;
  }
}

async function callLlm(prompt: string): Promise<string | null> {
  // Try Ollama first
  if (await isOllamaAvailable()) {
    const result = await ollamaGenerate(prompt);
    if (result) return result;
  }

  // TODO: Add cloud API fallback (OpenAI, Anthropic) when API keys are configured

  return null;
}

export async function detectLanguage(code: string): Promise<string | null> {
  const prompt = `Identify the programming language of this code. Respond with ONLY the language name in lowercase (e.g., "python", "bash", "javascript", "typescript", "rust", "go"). If it's a natural language prompt or instruction, respond with "prompt". If unsure, respond with "unknown".

Code:
${code.slice(0, 500)}`;

  const result = await callLlm(prompt);
  if (!result) return null;

  // Clean up response — extract just the language name
  const cleaned = result
    .toLowerCase()
    .replace(/[^a-z+#]/g, "")
    .trim();

  // Validate it looks like a language name
  const validLanguages = [
    "python", "javascript", "typescript", "bash", "sh", "zsh",
    "ruby", "go", "rust", "java", "kotlin", "swift", "c", "cpp",
    "csharp", "php", "perl", "lua", "r", "sql", "html", "css",
    "json", "yaml", "toml", "xml", "markdown", "prompt", "unknown",
  ];

  if (validLanguages.includes(cleaned)) return cleaned;

  // Try to find a valid language in the response
  for (const lang of validLanguages) {
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

  const prompt = `Suggest 2-5 short, relevant tags for this code snippet. Tags should be lowercase, single words or hyphenated. Prefer reusing existing tags when relevant.${existingStr}

Respond with ONLY a comma-separated list of tags, nothing else.

Content:
${content.slice(0, 1000)}`;

  const result = await callLlm(prompt);
  if (!result) return [];

  return result
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter((t) => t.length > 0 && t.length < 30);
}

export async function generateTitle(content: string): Promise<string | null> {
  const prompt = `Generate a short, descriptive title (3-7 words) for this code snippet. The title should describe what the code does. Respond with ONLY the title, nothing else.

Content:
${content.slice(0, 1000)}`;

  const result = await callLlm(prompt);
  if (!result) return null;

  // Clean up — remove quotes, periods, excessive length
  return result
    .replace(/^["']|["']$/g, "")
    .replace(/\.+$/, "")
    .trim()
    .slice(0, 80);
}

export async function generateAliases(
  title: string,
  content: string,
): Promise<string[]> {
  const prompt = `Generate 2-4 short alternative names or keywords someone might search for to find this snippet. These should be different phrasings, abbreviations, or related terms — NOT the title itself.

Respond with ONLY a comma-separated list, nothing else.

Title: ${title}
Content:
${content.slice(0, 500)}`;

  const result = await callLlm(prompt);
  if (!result) return [];

  return result
    .split(",")
    .map((a) => a.trim().toLowerCase().replace(/[^a-z0-9 -]/g, ""))
    .filter((a) => a.length > 0 && a.length < 50);
}

export async function generateDescription(content: string): Promise<string | null> {
  const prompt = `Write a one-line description of what this code does. Keep it under 100 characters. Respond with ONLY the description.

Content:
${content.slice(0, 1000)}`;

  const result = await callLlm(prompt);
  if (!result) return null;

  return result.replace(/\.+$/, "").trim().slice(0, 100);
}

/**
 * Enrich a snippet's frontmatter by filling in any fields the user didn't provide.
 * Runs LLM calls in parallel for speed. Returns updated frontmatter fields only.
 */
export async function enrichSnippet(
  frontmatter: SnippetFrontmatter,
  content: string,
): Promise<Partial<SnippetFrontmatter>> {
  if (!(await isOllamaAvailable())) return {};

  const updates: Partial<SnippetFrontmatter> = {};
  const tasks: Promise<void>[] = [];

  if (!frontmatter.description) {
    tasks.push(
      generateDescription(content).then((desc) => {
        if (desc) updates.description = desc;
      }),
    );
  }

  if (frontmatter.aliases.length === 0) {
    tasks.push(
      generateAliases(frontmatter.title, content).then((aliases) => {
        if (aliases.length > 0) updates.aliases = aliases;
      }),
    );
  }

  if (!frontmatter.language) {
    tasks.push(
      detectLanguage(content).then((lang) => {
        if (lang && lang !== "unknown") updates.language = lang;
      }),
    );
  }

  if (frontmatter.tags.length === 0) {
    tasks.push(
      suggestTags(content).then((tags) => {
        if (tags.length > 0) updates.tags = tags;
      }),
    );
  }

  if (!frontmatter.title || frontmatter.title.startsWith("untitled-")) {
    tasks.push(
      generateTitle(content).then((title) => {
        if (title) updates.title = title;
      }),
    );
  }

  await Promise.all(tasks);
  return updates;
}
