import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { status } from "./format.js";

const STATUS_FILENAME = ".snip-qmd-status";

/** Read QMD status file without deleting it. */
export function checkQmdStatus(libraryPath: string): string | null {
  const statusPath = resolve(libraryPath, STATUS_FILENAME);

  if (!existsSync(statusPath)) {
    return null;
  }

  const content = readFileSync(statusPath, "utf-8").trim();
  return content || null;
}

/** Delete the QMD status file. */
export function clearQmdStatus(libraryPath: string): void {
  const statusPath = resolve(libraryPath, STATUS_FILENAME);
  if (existsSync(statusPath)) {
    unlinkSync(statusPath);
  }
}

/** Surface QMD errors as a warning, then clear the status file. */
export function surfaceQmdErrors(libraryPath: string): void {
  const errors = checkQmdStatus(libraryPath);
  if (errors) {
    console.error(status.warn(errors));
    clearQmdStatus(libraryPath);
  }
}
