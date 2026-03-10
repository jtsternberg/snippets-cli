import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isDebugMode } from "./debug.js";

/**
 * Run a CLI agent by passing the prompt via stdin.
 * Writes prompt to a temp file for debug inspection.
 * Uses execFileSync with stdin input — no shell escaping needed.
 */
export function cliExec(opts: {
  cmd: string;
  args: string[];
  prompt: string;
  timeout?: number;
}): string | null {
  const { cmd, args, prompt, timeout = 45_000 } = opts;
  const tmpPath = join(tmpdir(), `snip-prompt-${Date.now()}.txt`);

  try {
    writeFileSync(tmpPath, prompt, "utf-8");

    if (isDebugMode()) {
      console.error(`[debug] Prompt written to: ${tmpPath}`);
      console.error(`[debug] $ cat ${tmpPath} | ${cmd} ${args.join(" ")}`);
    }

    const result = execFileSync(cmd, args, {
      input: prompt,
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    return result?.trim() || null;
  } catch (err) {
    if (isDebugMode()) {
      console.error(`[debug] CLI exec failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  } finally {
    if (!isDebugMode()) {
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}
