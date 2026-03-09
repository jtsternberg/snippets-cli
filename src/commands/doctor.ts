import { Command } from "commander";
import { existsSync } from "node:fs";
import { configExists, loadConfig, getLibraryPath, getConfigPath } from "../lib/config.js";
import { isQmdInstalled } from "../lib/qmd.js";
import { getAllSnippets } from "../lib/resolve.js";

export const doctorCommand = new Command("doctor")
  .description("Check health of snippet library and integrations")
  .action(async () => {
    let issues = 0;

    // 1. Config
    console.log("Config:");
    if (configExists()) {
      console.log(`  OK  Config exists at ${getConfigPath()}`);
    } else {
      console.log(`  !!  No config found. Run: snip init`);
      issues++;
    }

    // 2. Library path
    console.log("\nLibrary:");
    const config = loadConfig();
    const libPath = getLibraryPath(config);
    if (existsSync(libPath)) {
      console.log(`  OK  Library exists at ${libPath}`);

      // Check type directories
      for (const type of config.types) {
        const typeDir = `${libPath}/${type}`;
        if (existsSync(typeDir)) {
          console.log(`  OK  ${type}/ directory exists`);
        } else {
          console.log(`  !!  ${type}/ directory missing`);
          issues++;
        }
      }
    } else {
      console.log(`  !!  Library not found at ${libPath}. Run: snip init`);
      issues++;
    }

    // 3. Snippets
    console.log("\nSnippets:");
    const snippets = getAllSnippets();
    console.log(`  OK  ${snippets.length} snippet(s) found`);

    // Check for broken cross-links
    const allSlugs = new Set(snippets.map((s) => s.slug));
    let brokenLinks = 0;
    for (const s of snippets) {
      for (const rel of s.frontmatter.related) {
        const match = rel.match(/\[\[(.+?)\]\]/);
        if (match && !allSlugs.has(match[1])) {
          console.log(`  !!  Broken link in ${s.slug}: ${rel}`);
          brokenLinks++;
        }
      }
    }
    if (brokenLinks === 0 && snippets.length > 0) {
      console.log(`  OK  No broken cross-links`);
    }
    issues += brokenLinks;

    // 4. qmd
    console.log("\nqmd:");
    const hasQmd = await isQmdInstalled();
    if (hasQmd) {
      console.log(`  OK  qmd is installed`);
    } else {
      console.log(`  --  qmd not installed (optional). Install: npm i -g @tobilu/qmd`);
    }

    // 5. Ollama
    console.log("\nOllama:");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`${config.llm.ollamaHost}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        console.log(`  OK  Ollama is running at ${config.llm.ollamaHost}`);
      } else {
        console.log(`  --  Ollama not responding (optional)`);
      }
    } catch {
      console.log(`  --  Ollama not running at ${config.llm.ollamaHost} (optional)`);
    }

    // Summary
    console.log("");
    if (issues === 0) {
      console.log("All checks passed!");
    } else {
      console.log(`${issues} issue(s) found.`);
    }
  });
