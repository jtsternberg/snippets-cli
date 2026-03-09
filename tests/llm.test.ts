import { describe, it, expect } from "vitest";
import { isOllamaAvailable } from "../src/lib/llm.js";

describe("LLM provider chain", () => {
  it("isOllamaAvailable returns boolean", async () => {
    const result = await isOllamaAvailable();
    expect(typeof result).toBe("boolean");
  });
});
