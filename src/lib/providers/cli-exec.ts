import { execFile } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isDebugMode } from "./debug.js";

/**
 * Run a CLI agent by passing the prompt via stdin.
 * Writes prompt to a temp file for debug inspection.
 * Uses async execFile so the event loop stays unblocked (spinners work).
 */
export function cliExec(opts: {
  cmd: string;
  args: string[];
  prompt: string;
  timeout?: number;
}): Promise<string | null> {
  const { cmd, args, prompt, timeout = 45_000 } = opts;
  const tmpPath = join(tmpdir(), `snip-prompt-${Date.now()}.txt`);

  writeFileSync(tmpPath, prompt, "utf-8");

  if (isDebugMode()) {
    console.error(`[debug] Prompt written to: ${tmpPath}`);
    console.error(`[debug] $ cat ${tmpPath} | ${cmd} ${args.join(" ")}`);
  }

  return new Promise((resolve) => {
    const child = execFile(cmd, args, { timeout, encoding: "utf-8" }, (err, stdout) => {
      if (!isDebugMode()) {
        try { unlinkSync(tmpPath); } catch { /* ignore */ }
      }

      if (err) {
        if (isDebugMode()) {
          console.error(`[debug] CLI exec failed: ${err.message}`);
        }
        resolve(null);
        return;
      }

      resolve(stdout?.trim() || null);
    });

    // Write prompt to stdin
    if (child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }
  });
}
