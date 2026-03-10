import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { configExists, loadConfig, getLibraryPath, getConfigPath } from "../lib/config.js";
import { isQmdInstalled } from "../lib/qmd.js";
import { getAllSnippets } from "../lib/resolve.js";
import { detectShell, getCompletionPath } from "./install.js";

export async function runDoctorCheck(): Promise<void> {
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

  // 4. Shell completions
  const shell = detectShell();
  const completionPath = getCompletionPath(shell);
  console.log("\nCompletions:");
  if (completionPath && existsSync(completionPath)) {
    console.log(`  OK  ${shell} completion file exists at ${completionPath}`);

    // Check if completions are wired up to actually load
    if (shell === "zsh") {
      const zshrc = resolve(homedir(), ".zshrc");
      if (existsSync(zshrc)) {
        const content = readFileSync(zshrc, "utf-8");
        const hasFpath = content.includes(".zsh/completions") && content.includes("fpath");
        const hasCompinit = content.includes("compinit");
        if (hasFpath && hasCompinit) {
          console.log(`  OK  ~/.zshrc has fpath and compinit configured`);
        } else {
          if (!hasFpath) {
            console.log(`  !!  ~/.zshrc missing fpath for completions directory`);
            issues++;
          }
          if (!hasCompinit) {
            console.log(`  !!  ~/.zshrc missing compinit`);
            issues++;
          }
        }
      } else {
        console.log(`  !!  No ~/.zshrc found — completions won't load`);
        issues++;
      }
    } else if (shell === "bash") {
      const bashrc = resolve(homedir(), ".bashrc");
      if (existsSync(bashrc)) {
        const content = readFileSync(bashrc, "utf-8");
        if (content.includes(completionPath) || content.includes("bash-completion")) {
          console.log(`  OK  ~/.bashrc sources completions`);
        } else {
          console.log(`  !!  ~/.bashrc may not source ${completionPath}`);
          console.log(`      Add: [ -f ${completionPath} ] && source ${completionPath}`);
          issues++;
        }
      } else {
        console.log(`  !!  No ~/.bashrc found — completions won't load`);
        issues++;
      }
    } else if (shell === "fish") {
      // Fish auto-loads from ~/.config/fish/completions/
      console.log(`  OK  fish auto-loads completions from this path`);
    }
  } else if (completionPath) {
    console.log(`  --  ${shell} completions not installed. Run: snip install completions`);
  } else {
    console.log(`  --  Could not determine completion path for shell: ${shell}`);
  }

  // 5. qmd
  console.log("\nqmd:");
  const hasQmd = await isQmdInstalled();
  if (hasQmd) {
    console.log(`  OK  qmd is installed`);
  } else {
    console.log(`  --  qmd not installed (optional). Install: npm i -g @tobilu/qmd`);
  }

  // 6. Ollama
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
}

export const doctorCommand = new Command("doctor")
  .description("Check health of snippet library and integrations")
  .action(runDoctorCheck);
