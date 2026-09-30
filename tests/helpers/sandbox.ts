import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Tests must never reach the real qmd or Ollama: the snip post-commit hook
// backgrounds `qmd update && qmd embed`, which with a sandboxed HOME downloads
// a ~318MB model per test dir, and `snip add` sends unfilled fields to Ollama.
// Stripping PATH can't hide qmd on its own — Homebrew puts node, git and qmd
// in the same directory — so PATH is built from these generated bin dirs.
const BIN_ROOT = resolve(process.cwd(), "node_modules/.cache/snip-test-bin");
const QMD_STUB_DIR = resolve(BIN_ROOT, "qmd-stub");
const NO_QMD_DIR = resolve(BIN_ROOT, "no-qmd");

/** Discard port: connections are refused immediately, so LLM enrichment is skipped. */
export const OFFLINE_OLLAMA_HOST = "http://127.0.0.1:9";

const QMD_STUB = `#!/bin/sh
[ -n "$SNIP_TEST_QMD_LOG" ] && echo "$*" >> "$SNIP_TEST_QMD_LOG"
case "$1" in query|search|vsearch) echo "[]" ;; esac
exit 0
`;

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
  chmodSync(path, 0o755);
}

/** Called once from globalSetup. */
export function createTestBins(): void {
  mkdirSync(QMD_STUB_DIR, { recursive: true });
  mkdirSync(NO_QMD_DIR, { recursive: true });
  writeExecutable(resolve(QMD_STUB_DIR, "qmd"), QMD_STUB);

  const git = execFileSync("which", ["git"], { encoding: "utf-8" }).trim();
  writeExecutable(resolve(NO_QMD_DIR, "node"), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`);
  writeExecutable(resolve(NO_QMD_DIR, "git"), `#!/bin/sh\nexec "${git}" "$@"\n`);
}

const SECRET_ENV = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"];

/**
 * process.env minus LLM API keys, with PATH sandboxed:
 * - `qmd: "stub"` (default): real PATH, but `qmd` resolves to a no-op stub.
 * - `qmd: "none"`: only node, git and system bins — `which qmd` fails.
 */
export function sandboxEnv(opts: { qmd?: "stub" | "none" } = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of SECRET_ENV) delete env[key];
  env.PATH =
    opts.qmd === "none"
      ? [NO_QMD_DIR, "/usr/bin", "/bin"].join(":")
      : [QMD_STUB_DIR, process.env.PATH].join(":");
  return env;
}

/** Point a config written by `snip init` at the offline Ollama host. */
export function useOfflineLlm(configDir: string): void {
  const path = resolve(configDir, "snip", "config.json");
  const config = JSON.parse(readFileSync(path, "utf-8"));
  config.llm = { ...config.llm, ollamaHost: OFFLINE_OLLAMA_HOST };
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}
