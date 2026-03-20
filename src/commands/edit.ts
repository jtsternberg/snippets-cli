import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolveSnippetLoose, exitIfNotFound } from "../lib/resolve.js";
import { parseSnippetFile, writeSnippetFile } from "../lib/frontmatter.js";
import { loadConfig } from "../lib/config.js";
import { EXIT_CODES } from "../types/index.js";

export const editCommand = new Command("edit")
  .description("Open a snippet in your editor")
  .argument("<name>", "Snippet name or slug")
  .action(async (name: string) => {
    const result = resolveSnippetLoose(name);

    exitIfNotFound(result, name);

    const config = loadConfig();
    const editor = config.editor || process.env.EDITOR || "vi";
    const filePath = result.snippet.filePath;

    // Snapshot content before editor opens (for phantom commit prevention)
    const contentBefore = readFileSync(filePath, "utf-8");

    const [editorCmd, ...editorArgs] = editor.split(/\s+/);
    const child = spawnSync(editorCmd, [...editorArgs, filePath], {
      stdio: "inherit",
    });

    if (child.status !== 0) {
      console.error("Editor exited with error.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    // Only update modified timestamp if content actually changed
    const contentAfter = readFileSync(filePath, "utf-8");
    if (contentAfter !== contentBefore) {
      const updated = parseSnippetFile(filePath);
      writeSnippetFile(filePath, updated.frontmatter, updated.content);
      console.log(`Updated: ${filePath}`);
    } else {
      console.log(`No changes: ${filePath}`);
    }
  });
