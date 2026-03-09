import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import {
  configExists,
  getDefaultConfig,
  saveConfig,
  getConfigPath,
} from "../lib/config.js";
import { EXIT_CODES } from "../types/index.js";
import { registerCollection, ensureQmd } from "../lib/qmd.js";

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
        [".qmd/", ".DS_Store", ".obsidian/workspace.json", ""].join("\n"),
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

    console.log(
      `\nTip: Open ${libraryPath} as an Obsidian vault for visual browsing.`,
    );
  });
