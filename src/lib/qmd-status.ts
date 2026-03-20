import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { status } from "./format.js";

const STATUS_FILENAME = ".snip-qmd-status";

export function checkQmdStatus(libraryPath: string): string | null {
  const statusPath = resolve(libraryPath, STATUS_FILENAME);

  if (!existsSync(statusPath)) {
    return null;
  }

  const content = readFileSync(statusPath, "utf-8").trim();
  unlinkSync(statusPath);

  return content || null;
}

export function surfaceQmdErrors(libraryPath: string): void {
  const errors = checkQmdStatus(libraryPath);
  if (errors) {
    console.error(status.warn(errors));
  }
}
