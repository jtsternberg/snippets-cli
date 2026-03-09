import { Command } from "commander";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { input, select } from "@inquirer/prompts";
import { getLibraryPath, loadConfig } from "../lib/config.js";
import {
  createNewFrontmatter,
  writeSnippetFile,
} from "../lib/frontmatter.js";
import { uniqueSlug } from "../lib/slug.js";
import { readClipboard } from "../lib/clipboard.js";
import { EXIT_CODES } from "../types/index.js";
import { updateAndEmbed } from "../lib/qmd.js";
import { detectLanguage, suggestTags, generateTitle } from "../lib/llm.js";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";

export const addCommand = new Command("add")
  .description("Add a new snippet")
  .option("-t, --type <type>", "Snippet type (directory)")
  .option("-l, --lang <language>", "Programming language")
  .option("--tags <tags>", "Comma-separated tags")
  .option("--title <title>", "Snippet title")
  .option("--from-clipboard", "Create snippet from clipboard content")
  .option("--content <content>", "Snippet content (non-interactive)")
  .action(async (opts) => {
    const config = loadConfig();
    const libPath = getLibraryPath(config);

    if (!existsSync(libPath)) {
      console.error(
        "Snippet library not initialized. Run `snip init` first.",
      );
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }

    let title = opts.title || "";
    let language = opts.lang || "";
    let tags: string[] = opts.tags ? opts.tags.split(",").map((t: string) => t.trim()) : [];
    let type = opts.type || config.defaultType;
    let content = opts.content || "";

    if (opts.fromClipboard) {
      content = await readClipboard();
      if (!content.trim()) {
        console.error("Clipboard is empty.");
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }

      // LLM auto-detect for clipboard content
      if (!language) {
        const detected = await detectLanguage(content);
        if (detected && detected !== "unknown") {
          language = detected;
          console.log(`  Auto-detected language: ${language}`);
        }
      }

      if (tags.length === 0) {
        const suggested = await suggestTags(content);
        if (suggested.length > 0) {
          tags = suggested;
          console.log(`  Suggested tags: ${tags.join(", ")}`);
        }
      }

      if (!title) {
        const generated = await generateTitle(content);
        if (generated) {
          title = generated;
          console.log(`  Generated title: ${title}`);
        } else {
          const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .slice(0, 19);
          title = `untitled-${timestamp}`;
        }
      }
    }

    // Interactive mode if no content provided
    if (!content) {
      if (!title) {
        title = await input({ message: "Title:" });
      }

      if (!language) {
        language = await input({
          message: "Language (e.g., bash, python, prompt):",
        });
      }

      if (tags.length === 0) {
        const tagsInput = await input({
          message: "Tags (comma-separated):",
        });
        tags = tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      if (config.types.length > 1 && !opts.type) {
        type = await select({
          message: "Type:",
          choices: config.types.map((t) => ({ value: t, name: t })),
        });
      }

      // Open editor for content
      const editor = config.editor || process.env.EDITOR || "vi";
      const tmpFile = resolve(
        tmpdir(),
        `snip-${Date.now()}.${language || "md"}`,
      );
      const fenceHint = language
        ? `\`\`\`${language}\n\n\`\`\``
        : "```\n\n```";
      writeFileSync(
        tmpFile,
        `# ${title}\n\n${fenceHint}\n`,
        "utf-8",
      );

      const result = spawnSync(editor, [tmpFile], {
        stdio: "inherit",
      });

      if (result.status !== 0) {
        console.error("Editor exited with error.");
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }

      content = readFileSync(tmpFile, "utf-8");
      unlinkSync(tmpFile);
    }

    // Ensure type directory exists
    const typeDir = resolve(libPath, type);
    mkdirSync(typeDir, { recursive: true });

    // Generate slug and file path
    const slug = uniqueSlug(title, typeDir);
    const filePath = resolve(typeDir, `${slug}.md`);

    // Build frontmatter
    const frontmatter = createNewFrontmatter({
      title,
      language,
      tags,
      type,
    });

    // If content doesn't already have a code fence and we have raw content from clipboard
    if (opts.fromClipboard && !content.includes("```")) {
      const lang = language || "";
      content = `\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
    }

    writeSnippetFile(filePath, frontmatter, content);

    console.log(`Created: ${filePath}`);
    console.log(`  Title: ${title}`);
    if (language) console.log(`  Language: ${language}`);
    if (tags.length) console.log(`  Tags: ${tags.join(", ")}`);

    // qmd post-hook: update index
    await updateAndEmbed();
  });
