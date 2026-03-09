import matter from "gray-matter";
import { readFileSync, writeFileSync } from "node:fs";
import type { Snippet, SnippetFrontmatter } from "../types/index.js";
import { basename } from "node:path";

const FRONTMATTER_DEFAULTS: SnippetFrontmatter = {
  title: "",
  tags: [],
  aliases: [],
  language: "",
  type: "snippet",
  date: "",
  modified: "",
  source: "",
  related: [],
  variables: [],
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseSnippetFile(filePath: string): Snippet {
  const raw = readFileSync(filePath, "utf-8");
  return parseSnippetString(raw, filePath);
}

export function parseSnippetString(raw: string, filePath: string): Snippet {
  const parsed = matter(raw);
  const data = parsed.data as Partial<SnippetFrontmatter>;

  const frontmatter: SnippetFrontmatter = {
    ...FRONTMATTER_DEFAULTS,
    ...data,
    tags: toStringArray(data.tags),
    aliases: toStringArray(data.aliases),
    related: toStringArray(data.related),
    variables: toStringArray(data.variables),
  };

  const slug = basename(filePath, ".md");

  return {
    frontmatter,
    content: parsed.content,
    body: parsed.content.trim(),
    filePath,
    slug,
  };
}

export function serializeSnippet(
  frontmatter: Partial<SnippetFrontmatter>,
  content: string,
): string {
  // Clean up frontmatter — omit empty/default fields
  const clean: Record<string, unknown> = {};

  if (frontmatter.title) clean.title = frontmatter.title;
  if (frontmatter.tags?.length) clean.tags = frontmatter.tags;
  if (frontmatter.aliases?.length) clean.aliases = frontmatter.aliases;
  if (frontmatter.language) clean.language = frontmatter.language;
  if (frontmatter.type) clean.type = frontmatter.type;
  if (frontmatter.date) clean.date = frontmatter.date;
  if (frontmatter.modified) clean.modified = frontmatter.modified;
  if (frontmatter.source) clean.source = frontmatter.source;
  if (frontmatter.related?.length) clean.related = frontmatter.related;
  if (frontmatter.variables?.length) clean.variables = frontmatter.variables;

  return matter.stringify(content, clean);
}

export function writeSnippetFile(
  filePath: string,
  frontmatter: Partial<SnippetFrontmatter>,
  content: string,
): void {
  const serialized = serializeSnippet(
    { ...frontmatter, modified: today() },
    content,
  );
  writeFileSync(filePath, serialized, "utf-8");
}

export function createNewFrontmatter(
  overrides: Partial<SnippetFrontmatter>,
): SnippetFrontmatter {
  const now = today();
  return {
    ...FRONTMATTER_DEFAULTS,
    date: now,
    modified: now,
    ...overrides,
  };
}

export function extractCodeBlocks(
  content: string,
): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || "",
      code: match[2].trimEnd(),
    });
  }

  return blocks;
}

export function extractCopyContent(snippet: Snippet): string {
  const blocks = extractCodeBlocks(snippet.content);

  if (blocks.length === 0) {
    return snippet.body;
  }

  if (blocks.length === 1) {
    return blocks[0].code;
  }

  return blocks.map((b) => b.code).join("\n\n");
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}
