import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, basename, join } from "node:path";

function getAllMarkdownFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMarkdownFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

export function isObsidianInstalled(): boolean {
  // Check for Obsidian.app on macOS
  if (process.platform === "darwin") {
    return existsSync("/Applications/Obsidian.app");
  }
  // On Linux, check for the obsidian binary
  try {
    execSync("which obsidian", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isObsidianRunning(): boolean {
  try {
    execSync("pgrep -ix Obsidian", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isObsidianCliAvailable(): boolean {
  try {
    execSync("which obsidian", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function getBacklinks(filePath: string, libraryPath: string): string[] {
  const slug = basename(filePath, ".md");
  const pattern = `[[${slug}]]`;
  const files = getAllMarkdownFiles(libraryPath);
  const backlinks: string[] = [];

  for (const file of files) {
    if (resolve(file) === resolve(filePath)) continue;
    const content = readFileSync(file, "utf-8");
    if (content.includes(pattern)) {
      backlinks.push(file);
    }
  }

  return backlinks;
}

export function getLinks(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  const slugs: string[] = [];

  for (const match of matches) {
    slugs.push(match[1]);
  }

  return slugs;
}

export function findOrphans(libraryPath: string): string[] {
  const files = getAllMarkdownFiles(libraryPath);
  const orphans: string[] = [];

  for (const file of files) {
    const backlinks = getBacklinks(file, libraryPath);
    const links = getLinks(file);

    if (backlinks.length === 0 && links.length === 0) {
      orphans.push(file);
    }
  }

  return orphans;
}

export function findUnresolved(libraryPath: string): string[] {
  const files = getAllMarkdownFiles(libraryPath);
  const existingSlugs = new Set(files.map((f) => basename(f, ".md")));
  const unresolved = new Set<string>();

  for (const file of files) {
    const links = getLinks(file);
    for (const link of links) {
      if (!existingSlugs.has(link)) {
        unresolved.add(link);
      }
    }
  }

  return [...unresolved];
}
