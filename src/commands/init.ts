import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { homedir } from "node:os";
import {
  configExists,
  getDefaultConfig,
  saveConfig,
  getConfigPath,
} from "../lib/config.js";
import { EXIT_CODES } from "../types/index.js";
import { registerCollection, ensureQmd } from "../lib/qmd.js";
import { initGitRepo, installPostCommitHook, commitAll } from "../lib/git.js";

export const initCommand = new Command("init")
  .description("Initialize a new snippet library")
  .argument("[path]", "Library path", "~/snippets")
  .option("-f, --force", "Overwrite existing configuration")
  .action(async (rawPath: string, opts: { force?: boolean }) => {
    const libraryPath = resolve(rawPath.replace(/^~/, homedir()));

    if (configExists() && !opts.force) {
      const existingConfig = getConfigPath();
      console.error(
        `Config already exists at ${existingConfig}. Use --force to overwrite.`,
      );
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }

    // Create library directory and type subdirectories
    const config = getDefaultConfig();
    config.libraryPath = libraryPath;

    mkdirSync(libraryPath, { recursive: true });

    for (const type of config.types) {
      mkdirSync(resolve(libraryPath, type), { recursive: true });
    }

    // Write .gitignore for the library
    const gitignorePath = resolve(libraryPath, ".gitignore");
    if (!existsSync(gitignorePath)) {
      writeFileSync(
        gitignorePath,
        [".qmd/", ".DS_Store", ".obsidian/workspace.json", ".snip-qmd-status", "*.swp", "*~", ".*.swp", ""].join("\n"),
        "utf-8",
      );
    }

    // Write README.md for the library
    const readmePath = resolve(libraryPath, "README.md");
    if (!existsSync(readmePath)) {
      const libName = basename(libraryPath);
      const typeDirs = config.types.map((t) => `- \`${t}/\``).join("\n");
      writeFileSync(
        readmePath,
        [
          `# ${libName}`,
          "",
          `A snippet library managed by [snip](https://github.com/jtsternberg/snippets-cli).`,
          "",
          "## Structure",
          "",
          typeDirs,
          "",
          "## Usage",
          "",
          "```bash",
          "# Add a snippet",
          "snip add my-snippet",
          "",
          "# Search snippets",
          "snip search <query>",
          "",
          "# Copy a snippet to clipboard",
          "snip copy <slug>",
          "```",
          "",
          "## Obsidian",
          "",
          "This library is compatible with [Obsidian](https://obsidian.md) — open this directory as a vault for visual browsing.",
          "",
        ].join("\n"),
        "utf-8",
      );
    }

    // Save global config
    saveConfig(config);

    console.log(`Snippet library initialized at ${libraryPath}`);
    console.log(`Config saved to ${getConfigPath()}`);
    console.log(`\nDirectories created:`);
    for (const type of config.types) {
      console.log(`  ${type}/`);
    }
    // Register qmd collection if available
    const hasQmd = await ensureQmd();
    if (hasQmd) {
      await registerCollection(libraryPath, config.qmd.collectionName);
      console.log(`\nqmd collection "${config.qmd.collectionName}" registered.`);
    }

    // Initialize git repo for version tracking
    initGitRepo(libraryPath);
    installPostCommitHook(libraryPath);
    commitAll(libraryPath, "snip: initialize collection");
    console.log(`\nGit repository initialized with post-commit hook.`);

    console.log(
      `\nTip: Open ${libraryPath} as an Obsidian vault for visual browsing.`,
    );
  });
