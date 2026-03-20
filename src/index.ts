import { Command } from "commander";
import { assertLibraryExists, getLibraryPath } from "./lib/config.js";
import { isGitRepo, initGitRepo, installPostCommitHook, isHookInstalled, commitAll, hasChanges } from "./lib/git.js";
import { surfaceQmdErrors } from "./lib/qmd-status.js";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { showCommand } from "./commands/show.js";
import { copyCommand } from "./commands/copy.js";
import { editCommand } from "./commands/edit.js";
import { rmCommand } from "./commands/rm.js";
import { listCommand } from "./commands/list.js";
import { tagsCommand } from "./commands/tags.js";
import {
  configCommand,
  configTypesAddCommand,
  configTypesRemoveCommand,
  configTypesFixCommand,
  configLibraryCommand,
  configLlmCommand,
  configLlmProviderCommand,
  configLlmFallbackCommand,
  configLlmKeyCommand,
  configLlmModelCommand,
} from "./commands/config.js";
import { renameCommand } from "./commands/rename.js";
import { searchCommand } from "./commands/search.js";
import { findCommand } from "./commands/find.js";
import { doctorCommand } from "./commands/doctor.js";
import { runCommand } from "./commands/run.js";
import { linkCommand } from "./commands/link.js";
import { importCommand } from "./commands/import.js";
import { createInstallCommand } from "./commands/install.js";
import { createUpgradeCommand } from "./commands/upgrade.js";
import { exportCommand } from "./commands/export.js";
import { execCommand } from "./commands/exec.js";
import { syncCommand } from "./commands/sync.js";
import { enrichCommand } from "./commands/enrich.js";
import { reindexCommand } from "./commands/reindex.js";

const program = new Command();

program
  .name("snip")
  .description("CLI snippet manager with semantic search and Obsidian-compatible storage")
  .version("0.1.1");

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(showCommand);
program.addCommand(copyCommand);
program.addCommand(editCommand);
program.addCommand(rmCommand);
program.addCommand(listCommand);
program.addCommand(tagsCommand);
program.addCommand(configCommand);
program.addCommand(configTypesAddCommand);
program.addCommand(configTypesRemoveCommand);
program.addCommand(configTypesFixCommand);
program.addCommand(configLibraryCommand);
program.addCommand(configLlmCommand);
program.addCommand(configLlmProviderCommand);
program.addCommand(configLlmFallbackCommand);
program.addCommand(configLlmKeyCommand);
program.addCommand(configLlmModelCommand);
program.addCommand(renameCommand);
program.addCommand(searchCommand);
program.addCommand(findCommand);
program.addCommand(doctorCommand);
program.addCommand(runCommand);
program.addCommand(linkCommand);
program.addCommand(importCommand);
program.addCommand(exportCommand);
program.addCommand(execCommand);
program.addCommand(syncCommand);
program.addCommand(enrichCommand);
program.addCommand(reindexCommand);
program.addCommand(createInstallCommand(program));
program.addCommand(createUpgradeCommand(program));

// Commands that don't require an initialized library
const LIBRARY_EXEMPT = new Set([
  "init", "doctor",
  "config", "config:types:remove", "config:library",
  "config:llm", "config:llm:provider", "config:llm:fallback", "config:llm:key", "config:llm:model",
]);

// Commands that modify snippet files and should trigger a git commit
const COMMIT_COMMANDS = new Set([
  "add", "edit", "rm", "rename", "enrich", "import", "sync",
  "config:types:add", "config:types:remove", "config:types:fix",
]);

function buildCommitMessage(name: string, actionCommand: Command): string {
  const args = actionCommand.processedArgs || [];
  switch (name) {
    case "add": {
      const title = actionCommand.opts()?.title || args[0] || "";
      return title ? `snip: add "${title}"` : "snip: add snippet";
    }
    case "edit":
      return args[0] ? `snip: edit "${args[0]}"` : "snip: edit snippet";
    case "rm":
      return args[0] ? `snip: rm "${args[0]}"` : "snip: rm snippet";
    case "rename":
      return args[0] && args[1] ? `snip: rename "${args[0]}" → "${args[1]}"` : "snip: rename snippet";
    case "enrich":
      return "snip: enrich snippets";
    case "import":
      return "snip: import files";
    case "sync":
      return "snip: sync with gist";
    default:
      return `snip: ${name}`;
  }
}

program.hook("preAction", (_thisCommand, actionCommand) => {
  const name = actionCommand.name();

  if (!LIBRARY_EXEMPT.has(name)) {
    assertLibraryExists(getLibraryPath());
  }

  // Surface any QMD errors from last async hook run (doctor checks this itself)
  if (name !== "doctor") {
    try {
      const libPath = getLibraryPath();
      if (libPath) {
        surfaceQmdErrors(libPath);
      }
    } catch {
      // Library path may not exist yet (e.g., during init)
    }
  }

  // Git setup: handles both fresh and pre-existing repos
  if (!LIBRARY_EXEMPT.has(name)) {
    try {
      const libPath = getLibraryPath();
      if (!isGitRepo(libPath)) {
        initGitRepo(libPath);
        installPostCommitHook(libPath);
        commitAll(libPath, "snip: initialize git tracking");
      } else if (!isHookInstalled(libPath)) {
        installPostCommitHook(libPath);
      }
    } catch {
      // Git operations are best-effort
    }
  }
});

program.hook("postAction", (_thisCommand, actionCommand) => {
  const name = actionCommand.name();

  if (COMMIT_COMMANDS.has(name)) {
    try {
      const libPath = getLibraryPath();
      if (isGitRepo(libPath) && hasChanges(libPath)) {
        const message = buildCommitMessage(name, actionCommand);
        commitAll(libPath, message);
      }
    } catch {
      // Git operations are best-effort
    }
  }
});

program.parseAsync(process.argv).catch((err) => {
  if (err?.name === "ExitPromptError") {
    process.exit(0);
  }
  throw err;
});
