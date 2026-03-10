import { execFileSync } from "node:child_process";
import { EXIT_CODES, type Snippet } from "../types/index.js";

export interface GistFileInfo {
  filename: string;
  language: string;
  content: string;
}

export interface GistInfo {
  id: string;
  description: string;
  public: boolean;
  updatedAt: string;
  files: GistFileInfo[];
}

export const LANG_TO_EXT: Record<string, string> = {
  javascript: ".js", typescript: ".ts", python: ".py", ruby: ".rb",
  bash: ".sh", zsh: ".sh", fish: ".fish", go: ".go", rust: ".rs",
  java: ".java", kotlin: ".kt", swift: ".swift", c: ".c", cpp: ".cpp",
  csharp: ".cs", php: ".php", perl: ".pl", lua: ".lua", r: ".r",
  sql: ".sql", html: ".html", css: ".css", scss: ".scss", json: ".json",
  yaml: ".yaml", toml: ".toml", xml: ".xml", markdown: ".md", prompt: ".md",
};

export function gistFilename(snippet: Snippet): string {
  const ext = LANG_TO_EXT[snippet.frontmatter.language] || ".md";
  return `${snippet.slug}${ext}`;
}

export function requireGh(): void {
  try {
    execFileSync("gh", ["--version"], { stdio: "pipe" });
  } catch {
    console.error("GitHub CLI (gh) is required for gist operations. Install: https://cli.github.com");
    process.exit(EXIT_CODES.EXTERNAL_TOOL_ERROR);
  }

  try {
    execFileSync("gh", ["auth", "status"], { stdio: "pipe" });
  } catch {
    console.error("Not authenticated with GitHub. Run: gh auth login");
    process.exit(EXIT_CODES.EXTERNAL_TOOL_ERROR);
  }
}

/**
 * Parse a gist URL or ID into just the ID.
 * Accepts: full URL, raw URL, or bare ID.
 */
export function parseGistId(input: string): string {
  // Full gist URL: https://gist.github.com/user/abc123 or https://gist.github.com/abc123
  const urlMatch = input.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i);
  if (urlMatch) return urlMatch[1];

  // Bare hex ID
  if (/^[a-f0-9]+$/i.test(input)) return input;

  console.error(`Invalid gist URL or ID: ${input}`);
  process.exit(EXIT_CODES.EXTERNAL_TOOL_ERROR);
}

/**
 * Fetch gist metadata and file contents via gh CLI.
 */
export function fetchGist(gistId: string): GistInfo {
  const raw = execFileSync("gh", [
    "gist", "view", gistId, "--json",
    "id,description,public,updatedAt,files",
  ], { encoding: "utf-8", stdio: "pipe" }).trim();

  const data = JSON.parse(raw);

  return {
    id: data.id,
    description: data.description || "",
    public: data.public,
    updatedAt: data.updatedAt || "",
    files: (data.files as Array<{ filename: string; language: string; content: string }>).map((f) => ({
      filename: f.filename,
      language: (f.language || "").toLowerCase(),
      content: f.content,
    })),
  };
}
