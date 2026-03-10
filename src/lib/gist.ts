import { execFileSync } from "node:child_process";
import { EXIT_CODES } from "../types/index.js";

export interface GistFileInfo {
  filename: string;
  language: string;
  content: string;
}

export interface GistInfo {
  id: string;
  description: string;
  public: boolean;
  files: GistFileInfo[];
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

  return input;
}

/**
 * Fetch gist metadata and file contents via gh CLI.
 */
export function fetchGist(gistId: string): GistInfo {
  const raw = execFileSync("gh", [
    "gist", "view", gistId, "--json",
    "id,description,public,files",
  ], { encoding: "utf-8", stdio: "pipe" }).trim();

  const data = JSON.parse(raw);

  return {
    id: data.id,
    description: data.description || "",
    public: data.public,
    files: (data.files as Array<{ filename: string; language: string; content: string }>).map((f) => ({
      filename: f.filename,
      language: (f.language || "").toLowerCase(),
      content: f.content,
    })),
  };
}
