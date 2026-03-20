import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkQmdStatus, surfaceQmdErrors } from "../../src/lib/qmd-status.js";

const STATUS_FILENAME = ".snip-qmd-status";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "snip-qmd-status-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("checkQmdStatus", () => {
  it("returns null when no status file exists", () => {
    expect(checkQmdStatus(dir)).toBeNull();
  });

  it("returns error text when status file has content", () => {
    writeFileSync(join(dir, STATUS_FILENAME), "render failed: bad template", "utf-8");
    expect(checkQmdStatus(dir)).toBe("render failed: bad template");
  });

  it("deletes the status file after reading", () => {
    const statusPath = join(dir, STATUS_FILENAME);
    writeFileSync(statusPath, "some error", "utf-8");

    checkQmdStatus(dir);
    expect(existsSync(statusPath)).toBe(false);
  });

  it("returns null for empty status file and deletes it", () => {
    const statusPath = join(dir, STATUS_FILENAME);
    writeFileSync(statusPath, "", "utf-8");

    expect(checkQmdStatus(dir)).toBeNull();
    expect(existsSync(statusPath)).toBe(false);
  });
});

describe("surfaceQmdErrors", () => {
  it("prints warning via console.error when errors present", () => {
    writeFileSync(join(dir, STATUS_FILENAME), "quarto exploded", "utf-8");

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    surfaceQmdErrors(dir);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("quarto exploded");
  });

  it("is silent when no errors present", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    surfaceQmdErrors(dir);

    expect(spy).not.toHaveBeenCalled();
  });

  it("clears the status file after surfacing", () => {
    const statusPath = join(dir, STATUS_FILENAME);
    writeFileSync(statusPath, "error msg", "utf-8");

    vi.spyOn(console, "error").mockImplementation(() => {});
    surfaceQmdErrors(dir);

    expect(existsSync(statusPath)).toBe(false);
  });
});
