import { Command } from "commander";
import { getAllSnippets } from "../lib/resolve.js";
import { EXIT_CODES, type Snippet } from "../types/index.js";
import { writeSnippetFile, extractCopyContent } from "../lib/frontmatter.js";
import { requireGh, fetchGist, gistFilename } from "../lib/gist.js";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve as resolvePath } from "node:path";

type SyncAction = "push" | "pull" | "conflict" | "up-to-date";

interface SyncResult {
  snippet: Snippet;
  action: SyncAction;
  gistId: string;
}

function detectAction(snippet: Snippet, gistUpdatedAt: string): SyncAction {
  const localModified = snippet.frontmatter.modified;
  const lastSync = snippet.frontmatter.gist_updated;

  if (!lastSync) {
    // Never synced — local is the source of truth
    return "push";
  }

  // Normalize all dates to YYYY-MM-DD for comparison (modified is already YYYY-MM-DD)
  const localDate = new Date(localModified);
  const gistDate = new Date(gistUpdatedAt.slice(0, 10));
  const syncDate = new Date(lastSync);

  const localChanged = localDate > syncDate;
  const gistChanged = gistDate > syncDate;

  if (localChanged && gistChanged) return "conflict";
  if (localChanged) return "push";
  if (gistChanged) return "pull";
  return "up-to-date";
}

function pushToGist(snippet: Snippet): void {
  const gistId = snippet.frontmatter.gist_id;
  const tmpDir = mkdtempSync(resolvePath(tmpdir(), "snip-sync-"));
  const tmpPath = resolvePath(tmpDir, gistFilename(snippet));

  try {
    writeFileSync(tmpPath, extractCopyContent(snippet), "utf-8");
    execFileSync("gh", ["gist", "edit", gistId, "--add", tmpPath], {
      stdio: "pipe",
    });
    writeSnippetFile(snippet.filePath, {
      ...snippet.frontmatter,
      gist_updated: new Date().toISOString().slice(0, 10),
    }, snippet.content);
  } finally {
    try { unlinkSync(tmpPath); } catch {}
    try { rmdirSync(tmpDir); } catch {}
  }
}

function pullFromGist(snippet: Snippet, gistContent: string): void {
  const lang = snippet.frontmatter.language;
  const fencedContent = lang
    ? `\n\`\`\`${lang}\n${gistContent}\n\`\`\`\n`
    : `\n\`\`\`\n${gistContent}\n\`\`\`\n`;

  writeSnippetFile(snippet.filePath, {
    ...snippet.frontmatter,
    gist_updated: new Date().toISOString().slice(0, 10),
  }, fencedContent);
}

export const syncCommand = new Command("sync")
  .description("Sync snippets with their linked GitHub Gists")
  .option("--push", "Force push local changes to gists")
  .option("--pull", "Force pull gist changes to local")
  .option("--dry-run", "Show what would be synced without making changes")
  .action(async (opts: { push?: boolean; pull?: boolean; dryRun?: boolean }) => {
    if (opts.push && opts.pull) {
      console.error("Cannot use --push and --pull together.");
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    const allSnippets = getAllSnippets();
    const linked = allSnippets.filter((s) => s.frontmatter.gist_id);

    if (linked.length === 0) {
      console.log("No snippets linked to gists. Use `snip export --to-gist` first.");
      return;
    }

    requireGh();

    console.log(`Found ${linked.length} gist-linked snippet(s)\n`);

    const results: SyncResult[] = [];

    for (const snippet of linked) {
      const gistId = snippet.frontmatter.gist_id;

      let gistUpdatedAt: string;
      let gistFileContent: string;

      try {
        const gist = fetchGist(gistId);
        gistUpdatedAt = gist.updatedAt;

        // Find the matching file in the gist
        const expectedFilename = gistFilename(snippet);
        const gistFile = gist.files.find((f) => f.filename === expectedFilename)
          || gist.files[0]; // fallback to first file
        gistFileContent = gistFile?.content || "";
      } catch (err) {
        console.error(`  ✗ ${snippet.slug}: failed to fetch gist ${gistId}`);
        continue;
      }

      let action: SyncAction;
      if (opts.push) {
        action = "push";
      } else if (opts.pull) {
        action = "pull";
      } else {
        action = detectAction(snippet, gistUpdatedAt);
      }

      results.push({ snippet, action, gistId });

      const symbols: Record<SyncAction, string> = {
        push: "↑",
        pull: "↓",
        conflict: "⚡",
        "up-to-date": "✓",
      };

      if (opts.dryRun) {
        console.log(`  ${symbols[action]} ${snippet.slug} — ${action}`);
        continue;
      }

      switch (action) {
        case "push":
          pushToGist(snippet);
          console.log(`  ↑ ${snippet.slug} — pushed to gist`);
          break;
        case "pull":
          pullFromGist(snippet, gistFileContent);
          console.log(`  ↓ ${snippet.slug} — pulled from gist`);
          break;
        case "conflict":
          console.log(`  ⚡ ${snippet.slug} — conflict (use --push or --pull to resolve)`);
          break;
        case "up-to-date":
          console.log(`  ✓ ${snippet.slug} — up to date`);
          break;
      }
    }

    // Summary
    const pushed = results.filter((r) => r.action === "push").length;
    const pulled = results.filter((r) => r.action === "pull").length;
    const conflicts = results.filter((r) => r.action === "conflict").length;
    const upToDate = results.filter((r) => r.action === "up-to-date").length;

    if (opts.dryRun) {
      console.log(`\nDry run: would push ${pushed}, would pull ${pulled}, ${conflicts} conflicts, ${upToDate} up to date`);
    } else {
      console.log(`\nSync complete: ${pushed} pushed, ${pulled} pulled, ${conflicts} conflicts, ${upToDate} up to date`);
    }

    if (conflicts > 0) {
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });
