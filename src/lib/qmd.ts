import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { loadConfig } from "./config.js";

const execFileAsync = promisify(execFile);

interface SpawnQmdResult {
  exitCode: number;
  stderr: string;
}

/** Run a qmd command, capturing stderr and exit code. Stdout is suppressed. */
function spawnQmd(
  args: string[],
  timeout: number,
): Promise<SpawnQmdResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn("qmd", args, {
      stdio: ["ignore", "ignore", "pipe"],
      timeout,
      env: { ...process.env, NO_COLOR: "1" },
    });
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("close", (code) =>
      resolve({ exitCode: code ?? 1, stderr: Buffer.concat(chunks).toString().trim() }),
    );
    child.on("error", (err) =>
      resolve({ exitCode: 1, stderr: err.message }),
    );
  });
}

let qmdWarningShown = false;

export interface QmdSearchResult {
  docid: string;
  score: number;
  file: string;
  snippet: string;
}

export async function isQmdInstalled(): Promise<boolean> {
  try {
    await execFileAsync("which", ["qmd"]);
    return true;
  } catch {
    return false;
  }
}

function warnOnce(message: string): void {
  if (!qmdWarningShown) {
    console.error(message);
    qmdWarningShown = true;
  }
}

export async function ensureQmd(): Promise<boolean> {
  const installed = await isQmdInstalled();
  if (!installed) {
    warnOnce(
      "qmd is not installed. Install with: npm i -g @tobilu/qmd\n" +
        "Falling back to text search.",
    );
    return false;
  }
  return true;
}

const QMD_CONFIG_PATH = resolve(homedir(), ".config/qmd/index.yml");

/** Read the registered path for a qmd collection from its config file. */
export function getCollectionPath(name: string): string | null {
  if (!existsSync(QMD_CONFIG_PATH)) return null;
  const content = readFileSync(QMD_CONFIG_PATH, "utf-8");
  // Match "  <name>:\n    path: <value>" in the YAML
  const re = new RegExp(`^  ${name}:\\s*\\n    path:\\s*(.+)$`, "m");
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

/** Find which collection name a given path is registered under, if any. */
export function getCollectionNameForPath(path: string): string | null {
  if (!existsSync(QMD_CONFIG_PATH)) return null;
  const content = readFileSync(QMD_CONFIG_PATH, "utf-8");
  // Match all "  <name>:\n    path: <value>" pairs
  const re = /^ {2}(\S+):\s*\n {4}path:\s*(.+)$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    if (match[2].trim() === path) return match[1];
  }
  return null;
}

const COLLECTION_CONTEXT =
  "Code snippets, prompt templates, and CLI commands managed by snip — reusable fragments in Obsidian-compatible markdown";

async function addCollectionContext(path: string): Promise<void> {
  try {
    await execFileAsync("qmd", ["context", "add", path, COLLECTION_CONTEXT]);
  } catch {
    // Context is nice-to-have, not critical
  }
}

export async function registerCollection(
  path: string,
  name: string,
): Promise<void> {
  if (!(await ensureQmd())) return;

  // Check existing state before acting — avoids fragile error message parsing
  const existingPath = getCollectionPath(name);
  const existingName = getCollectionNameForPath(path);

  if (existingPath === path && existingName === name) {
    // Already correctly registered
    return;
  }

  // Path registered under a different name — remove the old one first
  if (existingName && existingName !== name) {
    console.error(
      `Path already registered as "${existingName}", renaming to "${name}"...`,
    );
    await execFileAsync("qmd", ["collection", "remove", existingName]);
  }

  // Name registered with a different path — remove it first
  if (existingPath && existingPath !== path) {
    console.error(
      `qmd collection "${name}" points to ${existingPath}, expected ${path}. Re-registering...`,
    );
    await execFileAsync("qmd", ["collection", "remove", name]);
  }

  // Register (or re-register) the collection
  if (existingPath !== path || existingName !== name) {
    await execFileAsync("qmd", ["collection", "add", path, "--name", name]);
    await addCollectionContext(path);
  }
}

export async function embed(): Promise<void> {
  if (!(await ensureQmd())) return;
  const config = loadConfig();
  const result = await spawnQmd(["embed", "-c", config.qmd.collectionName], 120000);
  if (result.exitCode !== 0) {
    console.error(`qmd embed failed: ${result.stderr || `exit code ${result.exitCode}`}`);
  }
}

export async function update(): Promise<void> {
  if (!(await ensureQmd())) return;
  const config = loadConfig();
  const result = await spawnQmd(["update", "-c", config.qmd.collectionName], 60000);
  if (result.exitCode !== 0) {
    console.error(`qmd update failed: ${result.stderr || `exit code ${result.exitCode}`}`);
  }
}

export async function search(
  query: string,
  options: { maxResults?: number; mode?: "query" | "search" | "vsearch" } = {},
): Promise<QmdSearchResult[]> {
  if (!(await ensureQmd())) return [];

  const config = loadConfig();
  const mode = options.mode || "query";
  const maxResults = options.maxResults || 20;

  try {
    const { stdout } = await execFileAsync(
      "qmd",
      [
        mode,
        query,
        "-c",
        config.qmd.collectionName,
        "--json",
        "-n",
        String(maxResults),
      ],
      { timeout: 30000 },
    );

    return JSON.parse(stdout) as QmdSearchResult[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("no collection")) {
      console.error(
        `qmd collection "${config.qmd.collectionName}" not found. Run: snip init`,
      );
    }
    return [];
  }
}

export async function updateAndEmbed(): Promise<void> {
  await update();
  await embed();
}
