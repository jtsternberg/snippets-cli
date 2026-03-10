import { Command } from "commander";
import { getAllSnippets } from "../lib/resolve.js";
import { EXIT_CODES, type Snippet } from "../types/index.js";
import { writeSnippetFile } from "../lib/frontmatter.js";
import { requireGh, fetchGist } from "../lib/gist.js";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve as resolvePath } from "node:path";

const LANG_TO_EXT: Record<string, string> = {
  javascript: ".js", typescript: ".ts", python: ".py", ruby: ".rb",
  bash: ".sh", zsh: ".sh", fish: ".fish", go: ".go", rust: ".rs",
  java: ".java", kotlin: ".kt", swift: ".swift", c: ".c", cpp: ".cpp",
  csharp: ".cs", php: ".php", perl: ".pl", lua: ".lua", r: ".r",
  sql: ".sql", html: ".html", css: ".css", scss: ".scss", json: ".json",
  yaml: ".yaml", toml: ".toml", xml: ".xml", markdown: ".md", prompt: ".md",
};

function gistFilename(snippet: Snippet): string {
  const ext = LANG_TO_EXT[snippet.frontmatter.language] || ".md";
  return `${snippet.slug}${ext}`;
}

function extractCode(snippet: Snippet): string {
  const blocks: string[] = [];
  const regex = /```\w*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(snippet.content)) !== null) {
    blocks.push(match[1].trimEnd());
  }
  return blocks.length > 0 ? blocks.join("\n\n") : snippet.body;
}

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

  const localDate = new Date(localModified);
  const gistDate = new Date(gistUpdatedAt);
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
    writeFileSync(tmpPath, extractCode(snippet), "utf-8");
    execFileSync("gh", ["gist", "edit", gistId, "--add", tmpPath], {
      stdio: "pipe",
    });
    writeSnippetFile(snippet.filePath, {
      ...snippet.frontmatter,
      gist_updated: new Date().toISOString(),
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
    gist_updated: new Date().toISOString(),
  }, fencedContent);
}

export const syncCommand = new Command("sync")
  .description("Sync snippets with their linked GitHub Gists")
  .option("--push", "Force push local changes to gists")
  .option("--pull", "Force pull gist changes to local")
  .option("--dry-run", "Show what would be synced without making changes")
  .action(async (opts: { push?: boolean; pull?: boolean; dryRun?: boolean }) => {
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
        // Get updated_at from gh gist view
        const meta = JSON.parse(
          execFileSync("gh", [
            "gist", "view", gistId, "--json", "updatedAt",
          ], { encoding: "utf-8", stdio: "pipe" }).trim(),
        );
        gistUpdatedAt = meta.updatedAt;

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

    console.log(`\nSync complete: ${pushed} pushed, ${pulled} pulled, ${conflicts} conflicts, ${upToDate} up to date`);

    if (conflicts > 0) {
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });
