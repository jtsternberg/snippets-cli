import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const testDir = resolve(tmpdir(), `snip-integration-${Date.now()}`);
const configDir = resolve(testDir, ".config", "snip");
const libDir = resolve(testDir, "snippets");
const snipBin = resolve(process.cwd(), "dist/index.js");

function snip(args: string[], opts: { input?: string } = {}): string {
  return execFileSync("node", [snipBin, ...args], {
    env: {
      ...process.env,
      SNIP_LIBRARY: libDir,
      HOME: testDir,
      XDG_CONFIG_HOME: resolve(testDir, ".config"),
    },
    input: opts.input,
    encoding: "utf-8",
    timeout: 10000,
  }).trim();
}

beforeAll(() => {
  // Create library dirs and config
  mkdirSync(resolve(libDir, "snippets"), { recursive: true });
  mkdirSync(resolve(libDir, "prompts"), { recursive: true });
  mkdirSync(configDir, { recursive: true });

  writeFileSync(
    resolve(configDir, "config.json"),
    JSON.stringify({
      libraryPath: libDir,
      types: ["snippets", "prompts"],
      defaultType: "snippets",
      editor: "cat",
      llm: {
        provider: "ollama",
        ollamaModel: "qwen2.5-coder:7b",
        ollamaHost: "http://localhost:11434",
        fallbackProvider: null,
        openaiApiKey: null,
        anthropicApiKey: null,
      },
      qmd: { collectionName: "snip" },
      alfred: { maxResults: 20 },
    }),
    "utf-8",
  );

  // Build before tests (in case dist is stale)
  execFileSync("npm", ["run", "build"], { cwd: process.cwd(), encoding: "utf-8" });
});

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("snip add (non-interactive)", () => {
  it("creates a snippet from --content", { timeout: 30000 }, () => {
    const output = snip([
      "add",
      "--title", "Test Snippet",
      "--lang", "bash",
      "--tags", "test,integration",
      "--content", "echo hello world",
    ]);

    expect(output).toContain("Created:");
    expect(output).toContain("test-snippet");

    const filePath = resolve(libDir, "snippets", "test-snippet.md");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("title: Test Snippet");
    expect(content).toContain("language: bash");
    expect(content).toContain("echo hello world");
  });
});

describe("snip add --type validation", () => {
  it("rejects unregistered type with helpful error", { timeout: 15000 }, () => {
    let caught: { stderr?: string } | undefined;
    try {
      snip(["add", "--title", "Bad Type", "--content", "echo hi", "--type", "command"]);
    } catch (err: unknown) {
      caught = err as { stderr: string };
    }
    expect(caught).toBeDefined();
    expect(caught!.stderr).toContain('Type "command" is not registered');
    expect(caught!.stderr).toContain("snip config:types:add command");
  });

  it("does not create a directory for unregistered type", () => {
    try {
      snip(["add", "--title", "Ghost", "--content", "echo ghost", "--type", "phantom"]);
    } catch {
      // expected
    }
    expect(existsSync(resolve(libDir, "phantom"))).toBe(false);
  });

  it("accepts registered types", () => {
    const output = snip([
      "add", "--title", "Type Check OK", "--content", "echo ok", "--type", "snippets",
    ]);
    expect(output).toContain("Created:");
    // Clean up
    snip(["rm", "type-check-ok", "--force"]);
  });
});

describe("snip import --type validation", () => {
  it("rejects unregistered type on import", () => {
    const tmpFile = resolve(testDir, "import-test.sh");
    writeFileSync(tmpFile, "echo hello", "utf-8");

    expect(() =>
      snip(["import", tmpFile, "--type", "command", "--no-enrich"])
    ).toThrow();
  });
});

describe("snip list", () => {
  it("lists created snippets", () => {
    const output = snip(["list"]);
    expect(output).toContain("test-snippet");
    expect(output).toContain("Test Snippet");
  });

  it("supports --json output", () => {
    const output = snip(["list", "--json"]);
    const data = JSON.parse(output);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((s: { slug: string }) => s.slug === "test-snippet")).toBe(true);
  });

  it("filters by tag", () => {
    const output = snip(["list", "--tag", "integration"]);
    expect(output).toContain("test-snippet");
  });

  it("filters by language", () => {
    const output = snip(["list", "--lang", "bash"]);
    expect(output).toContain("test-snippet");
  });

  it("returns empty for non-matching filter", () => {
    const output = snip(["list", "--lang", "rust"]);
    expect(output).toContain("0 snippet(s)");
  });
});

describe("snip show", () => {
  it("displays snippet content", () => {
    const output = snip(["show", "test-snippet"]);
    expect(output).toContain("Test Snippet");
    expect(output).toContain("echo hello world");
  });

  it("supports --raw flag", () => {
    const output = snip(["show", "test-snippet", "--raw"]);
    expect(output).toContain("---");
    expect(output).toContain("title: Test Snippet");
  });

  it("supports --code flag", () => {
    const output = snip(["show", "test-snippet", "--code"]);
    expect(output).toContain("echo hello world");
    expect(output).not.toContain("title:");
  });

  it("exits with error for nonexistent snippet", () => {
    expect(() => snip(["show", "nonexistent"])).toThrow();
  });
});

describe("snip find", () => {
  it("finds snippets by text search", () => {
    const output = snip(["find", "hello"]);
    expect(output).toContain("test-snippet");
  });

  it("finds by tag name", () => {
    const output = snip(["find", "integration"]);
    expect(output).toContain("test-snippet");
  });

  it("returns no results for unmatched query", () => {
    const output = snip(["find", "zzzznonexistentzzzz"]);
    expect(output).toContain("No results");
  });

  it("supports --json output", () => {
    const output = snip(["find", "hello", "--json"]);
    const data = JSON.parse(output);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe("snip tags", () => {
  it("lists all tags with counts", () => {
    const output = snip(["tags"]);
    expect(output).toContain("test");
    expect(output).toContain("integration");
  });

  it("supports --json output", () => {
    const output = snip(["tags", "--json"]);
    const data = JSON.parse(output);
    expect(data.test).toBe(1);
    expect(data.integration).toBe(1);
  });
});

describe("snip doctor", () => {
  it("runs health check without errors", () => {
    const output = snip(["doctor"]);
    expect(output).toContain("Config:");
    expect(output).toContain("Library:");
    expect(output).toContain("Snippets:");
  });
});

describe("snip exec", () => {
  beforeAll(() => {
    snip([
      "add",
      "--title", "Exec Test Script",
      "--lang", "bash",
      "--content", 'echo "arg1=$1 arg2=$2"',
    ]);
  });

  afterAll(() => {
    snip(["rm", "exec-test-script", "--force"]);
  });

  it("executes snippet without passthrough args", () => {
    const output = snip(["exec", "exec-test-script"]);
    expect(output).toBe("arg1= arg2=");
  });

  it("passes arguments to script via -- separator", () => {
    const output = snip(["exec", "exec-test-script", "--", "hello", "world"]);
    expect(output).toBe("arg1=hello arg2=world");
  });

  it("passes arguments to script without -- separator", () => {
    const output = snip(["exec", "exec-test-script", "hello", "world"]);
    expect(output).toBe("arg1=hello arg2=world");
  });

  it("shows args in --dry-run output", () => {
    const output = snip(["exec", "exec-test-script", "--dry-run", "--", "hello", "world"]);
    expect(output).toContain('# args: "hello" "world"');
    expect(output).toContain('echo "arg1=$1 arg2=$2"');
  });

  it("--dry-run without args does not show args line", () => {
    const output = snip(["exec", "exec-test-script", "--dry-run"]);
    expect(output).not.toContain("# args:");
    expect(output).toContain('echo "arg1=$1 arg2=$2"');
  });

  it("passes arguments with spaces and special characters", () => {
    const output = snip(["exec", "exec-test-script", "--", "hello world", "it's here"]);
    expect(output).toBe("arg1=hello world arg2=it's here");
  });
});

describe("snip exec with {{template}} variables", () => {
  beforeAll(() => {
    snip([
      "add",
      "--title", "Template Exec Test",
      "--lang", "bash",
      "--content", 'echo "id={{id}} name={{name}}"',
    ]);
  });

  afterAll(() => {
    snip(["rm", "template-exec-test", "--force"]);
  });

  it("substitutes {{variables}} with positional args in order", () => {
    const output = snip(["exec", "template-exec-test", "--", "abc123", "widget"]);
    expect(output).toBe("id=abc123 name=widget");
  });

  it("substitutes {{variables}} in --dry-run output", () => {
    const output = snip(["exec", "template-exec-test", "--dry-run", "--", "abc123", "widget"]);
    expect(output).toContain('echo "id=abc123 name=widget"');
  });

  it("leaves unmatched {{variables}} when not enough args", () => {
    const output = snip(["exec", "template-exec-test", "--dry-run", "--", "abc123"]);
    expect(output).toContain('echo "id=abc123 name={{name}}"');
  });
});

describe("snip exec rejects fuzzy matches", () => {
  beforeAll(() => {
    snip([
      "add",
      "--title", "Fuzzy Exec Guard",
      "--lang", "bash",
      "--content", 'echo "executed"',
    ]);
  });

  afterAll(() => {
    snip(["rm", "fuzzy-exec-guard", "--force"]);
  });

  it("refuses to execute a fuzzy-only match and shows suggestion", () => {
    // "fuzzy-exec" is a substring of "fuzzy-exec-guard" — fuzzy match only
    let caught: { stderr?: string } | undefined;
    try {
      snip(["exec", "fuzzy-exec"]);
    } catch (err: unknown) {
      caught = err as { stderr: string };
    }
    expect(caught).toBeDefined();
    expect(caught!.stderr).toContain('not found');
    expect(caught!.stderr).toContain("Did you mean");
    expect(caught!.stderr).toContain("fuzzy-exec-guard");
  });

  it("still executes exact slug matches", () => {
    const output = snip(["exec", "fuzzy-exec-guard"]);
    expect(output).toBe("executed");
  });
});

describe("snip rename", () => {
  it("renames a snippet", () => {
    const output = snip(["rename", "test-snippet", "Renamed Snippet"]);
    expect(output).toContain("renamed-snippet");

    expect(existsSync(resolve(libDir, "snippets", "renamed-snippet.md"))).toBe(true);
    expect(existsSync(resolve(libDir, "snippets", "test-snippet.md"))).toBe(false);

    const listOutput = snip(["list"]);
    expect(listOutput).toContain("renamed-snippet");
  });
});

describe("snip rm", () => {
  it("removes a snippet", () => {
    const output = snip(["rm", "renamed-snippet", "--force"]);
    expect(output).toContain("Deleted:");

    expect(existsSync(resolve(libDir, "snippets", "renamed-snippet.md"))).toBe(false);

    const listOutput = snip(["list"]);
    expect(listOutput).toContain("No snippets found");
  });
});
