import { Command } from "commander";
import { execSync } from "node:child_process";
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

export const execCommand = new Command("exec")
  .description("Execute a snippet as a script")
  .argument("<name>", "Snippet name or slug")
  .option("--shell <shell>", "Override interpreter (e.g., bash, python3, node)")
  .option("--dry-run", "Print the command without executing")
  .action((name: string, opts: { shell?: string; dryRun?: boolean }) => {
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
      console.log(code);
      return;
    }

    try {
      execSync(code, {
        shell,
        stdio: "inherit",
      });
    } catch (err) {
      const exitCode = (err as { status?: number }).status ?? 1;
      process.exit(exitCode);
    }
  });
