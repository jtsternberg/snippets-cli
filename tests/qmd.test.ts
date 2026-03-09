import { describe, it, expect } from "vitest";
import { isQmdInstalled, ensureQmd } from "../src/lib/qmd.js";

describe("qmd wrapper", () => {
  it("isQmdInstalled returns boolean", async () => {
    const result = await isQmdInstalled();
    expect(typeof result).toBe("boolean");
  });

  it("ensureQmd returns boolean", async () => {
    const result = await ensureQmd();
    expect(typeof result).toBe("boolean");
  });
});
