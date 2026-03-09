import { Command } from "commander";
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { promisify } from "node:util";
import { confirm } from "@inquirer/prompts";
import { updateAndEmbed, isQmdInstalled } from "../lib/qmd.js";
import { loadConfig, getDefaultConfig } from "../lib/config.js";
import { runDoctorCheck } from "./doctor.js";
import { installShellCompletions } from "./install.js";

const execFileAsync = promisify(execFile);

/** Walk up from `startPath` looking for a `.git` directory. Returns the git root or null. */
function findGitRoot(startPath: string): string | null {
  let dir = startPath;
  while (true) {
    if (existsSync(resolve(dir, ".git"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Read the `version` field from `package.json` in the given directory. */
function readPackageVersion(repoPath: string): string {
  try {
    const pkgPath = resolve(repoPath, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Spawn a command with inherited stdio, resolving when it exits successfully. */
function runWithOutput(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) res();
      else rej(new Error(`Command failed (exit ${code ?? "?"}): ${cmd} ${args.join(" ")}`));
    });
    child.on("error", rej);
  });
}

export function createUpgradeCommand(program: Command): Command {
  return new Command("upgrade")
    .description("Update snip CLI and re-install integrations")
    .option("--yes", "Skip confirmation prompts")
    .action(async (opts: { yes?: boolean }) => {
      const yes = opts.yes ?? false;

      // 1. Detect install method
      let repoPath: string | undefined;
      try {
        const realPath = realpathSync(process.argv[1]);
        repoPath = findGitRoot(dirname(realPath)) ?? undefined;
      } catch {
        // ignore — treat as npm global install
      }

      // Show version before upgrade
      const versionBefore = repoPath ? readPackageVersion(repoPath) : "unknown";
      if (versionBefore !== "unknown") {
        console.log(`Current version: v${versionBefore}`);
      }

      // Capture HEAD SHA before upgrade (used for git log diff)
      let headBefore: string | undefined;
      if (repoPath) {
        try {
          const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoPath });
          headBefore = stdout.trim();
        } catch {
          // ignore
        }
      }

      // 2. Update
      console.log("\nUpdating snip CLI...");
      try {
        if (repoPath) {
          console.log(`  Git install detected at ${repoPath}`);
          await runWithOutput("git", ["pull"], repoPath);
          await runWithOutput("npm", ["install"], repoPath);
          await runWithOutput("npm", ["run", "build"], repoPath);
          console.log("  Build complete.");
        } else {
          console.log("  npm global install detected.");
          await runWithOutput("npm", ["update", "-g", "snippets-cli"], process.cwd());
        }
      } catch (err) {
        console.error(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }

      // Show version after upgrade
      if (repoPath) {
        const versionAfter = readPackageVersion(repoPath);
        if (versionBefore !== "unknown" && versionAfter !== "unknown") {
          if (versionBefore === versionAfter) {
            console.log(`\nVersion: v${versionAfter} (no change)`);
          } else {
            console.log(`\nUpdated: v${versionBefore} → v${versionAfter}`);
          }
        }
      }

      // 3. Show what changed (git log since previous HEAD)
      if (repoPath && headBefore) {
        try {
          const { stdout } = await execFileAsync(
            "git",
            ["log", "--oneline", `${headBefore}..HEAD`],
            { cwd: repoPath },
          );
          const log = stdout.trim();
          if (log) {
            console.log("\nChanges:");
            console.log(log);
          } else {
            console.log("\nNo new commits.");
          }
        } catch {
          // ignore — may not have git available
        }
      }

      // 4. Re-install completions
      const reinstallCompletions = yes
        ? true
        : await confirm({
            message: "Re-install shell completions? (recommended after upgrade)",
            default: true,
          });

      if (reinstallCompletions) {
        console.log();
        await installShellCompletions(program);
      }

      // 5. Re-index qmd collection
      console.log("\nRe-indexing qmd...");
      const hasQmd = await isQmdInstalled();
      if (hasQmd) {
        await updateAndEmbed();
        console.log("  qmd re-indexed.");
      } else {
        console.log("  qmd not installed, skipping.");
      }

      // 6. Config migration — log any new top-level keys added since last save.
      // Deep-merge in loadConfig() already applies nested defaults automatically;
      // this just surfaces what's new to the user.
      const defaults = getDefaultConfig();
      const config = loadConfig();
      const newKeys = Object.keys(defaults).filter((k) => !(k in config));
      if (newKeys.length > 0) {
        console.log(`\nNew config keys (auto-applied from defaults): ${newKeys.join(", ")}`);
      }

      // 7. Health check
      console.log("\nRunning health check...");
      await runDoctorCheck();
    });
}
