import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveSnippet, getFuzzyMatches } from "../lib/resolve.js";
import { extractCopyContent } from "../lib/frontmatter.js";
import { EXIT_CODES } from "../types/index.js";
import { fmt } from "../lib/format.js";

const LANG_CONFIG: Record<string, { shell: string; ext: string }> = {
  bash:       { shell: "bash",     ext: ".sh" },
  sh:         { shell: "sh",       ext: ".sh" },
  zsh:        { shell: "zsh",      ext: ".sh" },
  fish:       { shell: "fish",     ext: ".fish" },
  python:     { shell: "python3",  ext: ".py" },
  python3:    { shell: "python3",  ext: ".py" },
  ruby:       { shell: "ruby",     ext: ".rb" },
  node:       { shell: "node",     ext: ".js" },
  javascript: { shell: "node",     ext: ".js" },
  js:         { shell: "node",     ext: ".js" },
  typescript: { shell: "npx tsx",  ext: ".ts" },
  ts:         { shell: "npx tsx",  ext: ".ts" },
  perl:       { shell: "perl",     ext: ".pl" },
  php:        { shell: "php",      ext: ".php" },
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
    const langConfig = LANG_CONFIG[lang];
    const shell = opts.shell || langConfig?.shell || "bash";

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
    const ext = langConfig?.ext || ".sh";
    const tmpDir = mkdtempSync(join(tmpdir(), "snip-exec-"));
    const tmpFile = join(tmpDir, `script${ext}`);
    try {
      writeFileSync(tmpFile, code, { mode: 0o700 });
      const [interpreter, ...interpreterArgs] = shell.split(" ");
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
