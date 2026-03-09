import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function uniqueSlug(title: string, directory: string): string {
  const base = slugify(title);
  let candidate = base;
  let counter = 2;

  while (existsSync(resolve(directory, `${candidate}.md`))) {
    candidate = `${base}-${counter}`;
    counter++;
  }

  return candidate;
}
