import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { configExists, loadConfig, getLibraryPath, getConfigPath } from "../lib/config.js";
import { isQmdInstalled } from "../lib/qmd.js";
import { getAllSnippets } from "../lib/resolve.js";
import { detectShell, getCompletionPath } from "./install.js";
import { fmt, status } from "../lib/format.js";

export async function runDoctorCheck(): Promise<void> {
  let issues = 0;

  // 1. Config
  console.log(fmt.bold("Config:"));
  if (configExists()) {
    console.log(status.ok(`Config exists at ${getConfigPath()}`));
  } else {
    console.log(status.warn("No config found. Run: snip init"));
    issues++;
  }

  // 2. Library path
  console.log(fmt.bold("\nLibrary:"));
  const config = loadConfig();
  const libPath = getLibraryPath(config);
  if (existsSync(libPath)) {
    console.log(status.ok(`Library exists at ${libPath}`));

    // Check type directories
    for (const type of config.types) {
      const typeDir = `${libPath}/${type}`;
      if (existsSync(typeDir)) {
        console.log(status.ok(`${type}/ directory exists`));
      } else {
        console.log(status.warn(`${type}/ directory missing`));
        issues++;
      }
    }
  } else {
    console.log(status.warn(`Library not found at ${libPath}. Run: snip init`));
    issues++;
  }

  // 3. Snippets
  console.log(fmt.bold("\nSnippets:"));
  const snippets = getAllSnippets();
  console.log(status.ok(`${snippets.length} snippet(s) found`));

  // Check for broken cross-links
  const allSlugs = new Set(snippets.map((s) => s.slug));
  let brokenLinks = 0;
  for (const s of snippets) {
    for (const rel of s.frontmatter.related) {
      const match = rel.match(/\[\[(.+?)\]\]/);
      if (match && !allSlugs.has(match[1])) {
        console.log(status.warn(`Broken link in ${s.slug}: ${rel}`));
        brokenLinks++;
      }
    }
  }
  if (brokenLinks === 0 && snippets.length > 0) {
    console.log(status.ok("No broken cross-links"));
  }
  issues += brokenLinks;

  // 4. Shell completions
  const shell = detectShell();
  const completionPath = getCompletionPath(shell);
  console.log(fmt.bold("\nCompletions:"));
  if (completionPath && existsSync(completionPath)) {
    console.log(status.ok(`${shell} completion file exists at ${completionPath}`));

    // Check if completions are wired up to actually load
    if (shell === "zsh") {
      const zshrc = resolve(homedir(), ".zshrc");
      if (existsSync(zshrc)) {
        const content = readFileSync(zshrc, "utf-8");
        const hasFpath = content.includes(".zsh/completions") && content.includes("fpath");
        const hasCompinit = content.includes("compinit");
        if (hasFpath && hasCompinit) {
          console.log(status.ok("~/.zshrc has fpath and compinit configured"));
        } else {
          if (!hasFpath) {
            console.log(status.warn("~/.zshrc missing fpath for completions directory"));
            issues++;
          }
          if (!hasCompinit) {
            console.log(status.warn("~/.zshrc missing compinit"));
            issues++;
          }
        }
      } else {
        console.log(status.warn("No ~/.zshrc found — completions won't load"));
        issues++;
      }
    } else if (shell === "bash") {
      const bashrc = resolve(homedir(), ".bashrc");
      if (existsSync(bashrc)) {
        const content = readFileSync(bashrc, "utf-8");
        if (content.includes(completionPath) || content.includes("bash-completion")) {
          console.log(status.ok("~/.bashrc sources completions"));
        } else {
          console.log(status.warn(`~/.bashrc may not source ${completionPath}`));
          console.log(`      Add: [ -f ${completionPath} ] && source ${completionPath}`);
          issues++;
        }
      } else {
        console.log(status.warn("No ~/.bashrc found — completions won't load"));
        issues++;
      }
    } else if (shell === "fish") {
      // Fish auto-loads from ~/.config/fish/completions/
      console.log(status.ok("fish auto-loads completions from this path"));
    }
  } else if (completionPath) {
    console.log(status.info(`${shell} completions not installed. Run: snip install completions`));
  } else {
    console.log(status.info(`Could not determine completion path for shell: ${shell}`));
  }

  // 5. qmd
  console.log(fmt.bold("\nqmd:"));
  const hasQmd = await isQmdInstalled();
  if (hasQmd) {
    console.log(status.ok("qmd is installed"));
  } else {
    console.log(status.info("qmd not installed (optional). Install: npm i -g @tobilu/qmd"));
  }

  // 6. Ollama
  console.log(fmt.bold("\nOllama:"));
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${config.llm.ollamaHost}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (resp.ok) {
      console.log(status.ok(`Ollama is running at ${config.llm.ollamaHost}`));
    } else {
      console.log(status.info("Ollama not responding (optional)"));
    }
  } catch {
    console.log(status.info(`Ollama not running at ${config.llm.ollamaHost} (optional)`));
  }

  // Summary
  console.log("");
  if (issues === 0) {
    console.log(fmt.greenBold("All checks passed!"));
  } else {
    console.log(fmt.yellowBold(`${issues} issue(s) found.`));
  }
}

export const doctorCommand = new Command("doctor")
  .description("Check health of snippet library and integrations")
  .action(runDoctorCheck);
