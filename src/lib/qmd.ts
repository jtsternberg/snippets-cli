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

export async function registerCollection(
  path: string,
  name: string,
): Promise<void> {
  if (!(await ensureQmd())) return;

  try {
    await execFileAsync("qmd", ["collection", "add", path, "--name", name]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already exists")) {
      // Verify existing collection points to the correct path
      const existingPath = getCollectionPath(name);
      if (existingPath && existingPath !== path) {
        console.error(
          `qmd collection "${name}" points to ${existingPath}, expected ${path}. Re-registering...`,
        );
        await execFileAsync("qmd", ["collection", "remove", name]);
        await execFileAsync("qmd", ["collection", "add", path, "--name", name]);
      }
      return;
    }
    throw err;
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
