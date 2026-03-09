import { Command } from "commander";
import { input } from "@inquirer/prompts";
import { resolveSnippet, getFuzzyMatches } from "../lib/resolve.js";
import { extractCodeBlocks } from "../lib/frontmatter.js";
import { writeClipboard } from "../lib/clipboard.js";
import { EXIT_CODES } from "../types/index.js";

export const runCommand = new Command("run")
  .description("Fill template variables in a prompt and copy result")
  .argument("<name>", "Prompt snippet name or slug")
  .option("--var <vars...>", "Variable values as key=value pairs")
  .option("--no-copy", "Don't copy to clipboard, only print to stdout")
  .option("--skip-vars", "Leave unfilled variables as {{name}} without prompting")
  .action(async (name: string, opts: { var?: string[]; copy?: boolean; skipVars?: boolean }) => {
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

    // Extract the template content (code block content or full body)
    const blocks = extractCodeBlocks(snippet.content);
    let template: string;
    if (blocks.length > 0) {
      template = blocks.map((b) => b.code).join("\n\n");
    } else {
      template = snippet.body;
    }

    // Find all {{variable}} placeholders
    const variableRegex = /\{\{(\w+)\}\}/g;
    const requiredVars = new Set<string>();
    let match;
    while ((match = variableRegex.exec(template)) !== null) {
      requiredVars.add(match[1]);
    }

    if (requiredVars.size === 0) {
      // No variables — just copy the content
      if (opts.copy !== false) {
        await writeClipboard(template);
      }
      process.stdout.write(template);
      if (opts.copy !== false) {
        console.error(`\nCopied to clipboard: ${snippet.frontmatter.title}`);
      }
      return;
    }

    // Parse provided --var key=value pairs
    const providedVars = new Map<string, string>();
    if (opts.var) {
      for (const v of opts.var) {
        const eqIdx = v.indexOf("=");
        if (eqIdx === -1) {
          console.error(`Invalid variable format: "${v}". Use key=value.`);
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
        providedVars.set(v.slice(0, eqIdx), v.slice(eqIdx + 1));
      }
    }

    // Check for missing variables
    const missingVars = [...requiredVars].filter((v) => !providedVars.has(v));

    if (missingVars.length > 0 && !opts.skipVars) {
      // Interactive mode: prompt for missing variables if TTY
      if (process.stdin.isTTY) {
        for (const varName of missingVars) {
          const value = await input({
            message: `${varName}:`,
          });
          providedVars.set(varName, value);
        }
      } else {
        console.error(
          `Missing variables: ${missingVars.join(", ")}`,
        );
        console.error("Provide them with --var key=value");
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    }

    // Fill template
    let filled = template;
    for (const [key, value] of providedVars) {
      filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    // Output
    if (opts.copy !== false) {
      await writeClipboard(filled);
    }
    process.stdout.write(filled);
    if (opts.copy !== false) {
      console.error(`\nCopied to clipboard: ${snippet.frontmatter.title}`);
    }
  });
