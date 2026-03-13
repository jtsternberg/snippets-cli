import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveSnippet, getFuzzyMatches } from "../lib/resolve.js";
import { extractCopyContent } from "../lib/frontmatter.js";
import { EXIT_CODES } from "../types/index.js";
import { fmt } from "../lib/format.js";

const LANG_TO_SHELL: Record<string, string> = {
  bash: "bash",
  sh: "sh",
  zsh: "zsh",
  fish: "fish",
  python: "python3",
  python3: "python3",
  ruby: "ruby",
  node: "node",
  javascript: "node",
  js: "node",
  typescript: "npx tsx",
  ts: "npx tsx",
  perl: "perl",
  php: "php",
};

const LANG_TO_EXT: Record<string, string> = {
  bash: ".sh",
  sh: ".sh",
  zsh: ".sh",
  fish: ".fish",
  python: ".py",
  python3: ".py",
  ruby: ".rb",
  node: ".js",
  javascript: ".js",
  js: ".js",
  typescript: ".ts",
  ts: ".ts",
  perl: ".pl",
  php: ".php",
};

export const execCommand = new Command("exec")
  .description("Execute a snippet as a script")
  .argument("<name>", "Snippet name or slug")
  .argument("[scriptArgs...]", "Arguments to pass to the script")
  .option("--shell <shell>", "Override interpreter (e.g., bash, python3, node)")
  .option("--dry-run", "Print the command without executing")
  .action((name: string, scriptArgs: string[], opts: { shell?: string; dryRun?: boolean }) => {
    const result = resolveSnippet(name);

    if (!result) {
      const fuzzy = getFuzzyMatches(name);
      console.error(`Snippet "${name}" not found.`);
      if (fuzzy.length > 0) {
        console.error("\nDid you mean:");
        for (const s of fuzzy.slice(0, 5)) {
          console.error(`  ${s.slug} — ${s.frontmatter.title}`);
        }
      }
      process.exit(EXIT_CODES.NOT_FOUND);
    }

    const { snippet } = result;
    const code = extractCopyContent(snippet);

    if (!code.trim()) {
      console.error("Snippet has no code content to execute.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    // Determine interpreter
    const lang = snippet.frontmatter.language?.toLowerCase() || "";
    const shell = opts.shell || LANG_TO_SHELL[lang] || "bash";

    if (opts.dryRun) {
      console.log(fmt.dim(`# ${snippet.frontmatter.title}`));
      console.log(fmt.dim(`# interpreter: ${shell}`));
      if (scriptArgs.length > 0) {
        console.log(fmt.dim(`# args: ${scriptArgs.join(" ")}`));
      }
      console.log(code);
      return;
    }

    // Always write to a temp file so every interpreter (bash, node, python3, etc.)
    // receives the script as a file path and positional args work uniformly.
    const ext = LANG_TO_EXT[lang] || ".sh";
    const tmpDir = mkdtempSync(join(tmpdir(), "snip-exec-"));
    const tmpFile = join(tmpDir, `script${ext}`);
    try {
      writeFileSync(tmpFile, code, { mode: 0o700 });
      // Split multi-word interpreters (e.g. "npx tsx") but preserve paths with spaces
      // from --shell by only splitting known LANG_TO_SHELL values.
      const isKnownMultiWord = Object.values(LANG_TO_SHELL).includes(shell);
      const [interpreter, ...interpreterArgs] = isKnownMultiWord
        ? shell.split(" ")
        : [shell];
      const spawnResult = spawnSync(interpreter, [...interpreterArgs, tmpFile, ...scriptArgs], {
        stdio: "inherit",
      });
      if (spawnResult.error) {
        console.error(`Failed to execute snippet: ${spawnResult.error.message}`);
        process.exitCode = EXIT_CODES.GENERAL_ERROR;
      } else {
        process.exitCode = spawnResult.status ?? 0;
      }
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        console.error(`Warning: failed to clean up temp dir ${tmpDir}: ${e}`);
      }
    }
  });
