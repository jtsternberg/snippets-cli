import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { configExists, loadConfig, getLibraryPath, getConfigPath } from "../lib/config.js";
import { isQmdInstalled, getCollectionPath, registerCollection, updateAndEmbed } from "../lib/qmd.js";
import { isObsidianInstalled, isObsidianCliAvailable, getVaultName } from "../lib/obsidian.js";
import { getAllSnippets } from "../lib/resolve.js";
import { detectShell, getCompletionPath, installShellCompletions } from "./install.js";
import { fmt, status } from "../lib/format.js";

type FixId = "types" | "completions" | "obsidian-base" | "qmd";

export async function runDoctorCheck(
  opts: { fix?: boolean; program?: Command } = {},
): Promise<void> {
  let issues = 0;
  const fixes = new Set<FixId>();

  // 1. Config
  console.log(fmt.bold("Config:"));
  if (configExists()) {
    console.log(status.ok(`Config exists at ${getConfigPath()}`));
  } else {
    console.log(status.warn("No config found"));
    console.log(`      Fix: snip init [path]`);
    console.log(`      Example: snip init ~/snippets`);
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
        console.log(`      Fix: snip config:types:fix`);
        fixes.add("types");
        issues++;
      }
    }
  } else {
    console.log(status.warn(`Library not found at ${libPath}`));
    console.log(`      Fix: snip init [path]`);
    console.log(`      Example: snip init ~/snippets`);
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
        console.log(`      Fix: snip edit ${s.frontmatter.type}/${s.slug}`);
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
            console.log(`      Fix: snip install completions`);
            fixes.add("completions");
            issues++;
          }
          if (!hasCompinit) {
            console.log(status.warn("~/.zshrc missing compinit"));
            console.log(`      Fix: snip install completions`);
            fixes.add("completions");
            issues++;
          }
        }
      } else {
        console.log(status.warn("No ~/.zshrc found — completions won't load"));
        console.log(`      Create ~/.zshrc first, then run: snip install completions`);
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
          console.log(`      Add to ~/.bashrc: [ -f ${completionPath} ] && source ${completionPath}`);
          issues++;
        }
      } else {
        console.log(status.warn("No ~/.bashrc found — completions won't load"));
        console.log(`      Create ~/.bashrc, then add: [ -f ${completionPath} ] && source ${completionPath}`);
        issues++;
      }
    } else if (shell === "fish") {
      // Fish auto-loads from ~/.config/fish/completions/
      console.log(status.ok("fish auto-loads completions from this path"));
    }
  } else if (completionPath) {
    console.log(status.info(`${shell} completions not installed. Run: snip install completions`));
    fixes.add("completions");
  } else {
    console.log(status.info(`Could not determine completion path for shell: ${shell}`));
  }

  // 5. Obsidian
  console.log(fmt.bold("\nObsidian:"));
  if (isObsidianInstalled()) {
    console.log(status.ok("Obsidian is installed"));

    const hasCli = isObsidianCliAvailable();
    if (hasCli) {
      console.log(status.ok("Obsidian CLI is available"));
    } else {
      console.log(status.info("Obsidian CLI not installed (optional)"));
      console.log(`      Enable in: Obsidian > Settings > General > Command line interface`);
    }

    const vaultName = hasCli ? getVaultName(libPath) : null;
    if (vaultName) {
      console.log(status.ok(`Vault registered as "${vaultName}"`));

      // Check .base files for each type
      for (const type of config.types) {
        const typeDir = resolve(libPath, type);
        if (!existsSync(typeDir)) continue;
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        const basePath = resolve(typeDir, `${label}.base`);
        if (existsSync(basePath)) {
          console.log(status.ok(`${type}/${label}.base exists`));
        } else {
          console.log(status.warn(`${type}/${label}.base missing`));
          console.log(`      Fix: snip install obsidian`);
          fixes.add("obsidian-base");
          issues++;
        }
      }
    } else if (hasCli) {
      console.log(status.info("Vault not initialized"));
      console.log(`      Open Obsidian > Open another vault > Open folder as vault`);
      console.log(`      Select: ${libPath}`);
    } else {
      console.log(status.info("Install Obsidian CLI to check vault status"));
      console.log(`      Enable in: Obsidian > Settings > General > Command line interface`);
    }
  } else {
    console.log(status.info("Obsidian not installed (optional). Download: https://obsidian.md"));
  }

  // 6. qmd
  console.log(fmt.bold("\nqmd:"));
  const hasQmd = await isQmdInstalled();
  if (hasQmd) {
    console.log(status.ok("qmd is installed"));

    const collectionName = config.qmd.collectionName;
    const collectionPath = getCollectionPath(collectionName);

    if (!collectionPath) {
      console.log(status.warn(`qmd collection "${collectionName}" not registered`));
      console.log(`      Fix: snip install qmd`);
      fixes.add("qmd");
      issues++;
    } else {
      console.log(status.ok(`Collection "${collectionName}" registered`));

      if (!existsSync(collectionPath)) {
        console.log(status.warn(`Collection path does not exist: ${collectionPath}`));
        console.log(`      Fix: snip install qmd`);
        fixes.add("qmd");
        issues++;
      } else if (collectionPath !== libPath) {
        console.log(status.warn(`Collection path mismatch: ${collectionPath} (expected ${libPath})`));
        console.log(`      Fix: snip install qmd`);
        fixes.add("qmd");
        issues++;
      } else {
        console.log(status.ok(`Collection path matches library: ${collectionPath}`));
      }
    }
  } else {
    console.log(status.info("qmd not installed (optional)"));
    console.log(`      Install: npm i -g @tobilu/qmd`);
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
      console.log(`      Start with: ollama serve`);
    }
  } catch {
    console.log(status.info(`Ollama not running at ${config.llm.ollamaHost} (optional)`));
    console.log(`      Start with: ollama serve`);
    console.log(`      Install: https://ollama.ai`);
  }

  // Summary & auto-fix
  console.log("");
  if (issues === 0) {
    console.log(fmt.greenBold("All checks passed!"));
  } else if (opts.fix && fixes.size > 0) {
    console.log(fmt.bold(`Fixing ${fixes.size} auto-fixable issue(s)...\n`));

    if (fixes.has("types")) {
      console.log(fmt.dim("Running: snip config:types:fix"));
      const { configTypesFixCommand } = await import("./config.js");
      await configTypesFixCommand.parseAsync([], { from: "user" });
      console.log("");
    }

    if (fixes.has("completions") && opts.program) {
      console.log(fmt.dim("Running: snip install completions"));
      await installShellCompletions(opts.program);
      console.log("");
    }

    if (fixes.has("obsidian-base")) {
      // Reuse config:types:fix — it creates both dirs and .base files
      if (!fixes.has("types")) {
        console.log(fmt.dim("Running: snip config:types:fix"));
        const { configTypesFixCommand } = await import("./config.js");
        await configTypesFixCommand.parseAsync([], { from: "user" });
        console.log("");
      }
    }

    if (fixes.has("qmd")) {
      console.log(fmt.dim("Running: snip install qmd"));
      await registerCollection(libPath, config.qmd.collectionName);
      await updateAndEmbed();
      console.log(status.ok("qmd collection fixed"));
      console.log("");
    }

    console.log(fmt.greenBold("Auto-fix complete. Run snip doctor again to verify."));
  } else {
    console.log(fmt.yellowBold(`${issues} issue(s) found.`));
    if (fixes.size > 0) {
      console.log(fmt.dim(`${fixes.size} auto-fixable. Run: snip doctor --fix`));
    }
  }
}

export const doctorCommand = new Command("doctor")
  .description("Check health of snippet library and integrations")
  .option("--fix", "Auto-fix issues that can be resolved without user input")
  .action(async (cmdOpts: { fix?: boolean }) => {
    const program = doctorCommand.parent ?? undefined;
    await runDoctorCheck({ fix: cmdOpts.fix, program });
  });
