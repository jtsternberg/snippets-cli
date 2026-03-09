import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "./config.js";

const execFileAsync = promisify(execFile);

/** Run a qmd command with all output suppressed. Resolves when process exits. */
function spawnSilent(
  args: string[],
  timeout: number,
): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn("qmd", args, {
      stdio: "ignore",
      timeout,
      env: { ...process.env, NO_COLOR: "1" },
    });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
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

export async function registerCollection(
  path: string,
  name: string,
): Promise<void> {
  if (!(await ensureQmd())) return;

  try {
    await execFileAsync("qmd", ["collection", "add", path, "--name", name]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Collection may already exist
    if (message.includes("already exists")) {
      return;
    }
    throw err;
  }
}

export async function embed(): Promise<void> {
  if (!(await ensureQmd())) return;
  const config = loadConfig();
  await spawnSilent(["embed", "-c", config.qmd.collectionName], 120000);
}

export async function update(): Promise<void> {
  if (!(await ensureQmd())) return;
  const config = loadConfig();
  await spawnSilent(["update", "-c", config.qmd.collectionName], 60000);
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
