import { describe, it, expect } from "vitest";
import { extractCodeBlocks } from "../src/lib/frontmatter.js";
import {
  extractTemplateVariables,
  fillTemplateVariables,
  fillTemplateVariablesForShell,
  isShellSafe,
  shellQuote,
  getQuoteContext,
} from "../src/lib/template.js";

describe("template variable extraction", () => {
  it("extracts {{variables}} from template content", () => {
    const content = `Review the following {{language}} code with focus on {{focus_area}}.`;
    const vars = new Set(extractTemplateVariables(content).map((variable) => variable.name));

    expect(vars).toEqual(new Set(["language", "focus_area"]));
  });

  it("handles templates with no variables", () => {
    const content = `This is a static prompt with no variables.`;
    const vars = new Set(extractTemplateVariables(content).map((variable) => variable.name));

    expect(vars.size).toBe(0);
  });

  it("handles repeated variables", () => {
    const content = `Hello {{name}}, welcome {{name}}! Your role is {{role}}.`;
    const vars = new Set(extractTemplateVariables(content).map((variable) => variable.name));

    expect(vars).toEqual(new Set(["name", "role"]));
  });

  it("fills template variables correctly", () => {
    const template = `Review the following {{language}} code with focus on {{focus_area}}.`;
    const vars = new Map([
      ["language", "python"],
      ["focus_area", "security"],
    ]);

    const filled = fillTemplateVariables(template, vars);

    expect(filled).toBe(
      "Review the following python code with focus on security.",
    );
  });

  it("leaves unfilled variables as-is when not provided", () => {
    const template = `Hello {{name}}, your role is {{role}}.`;
    const vars = new Map([["name", "Alice"]]);

    const filled = fillTemplateVariables(template, vars);

    expect(filled).toBe("Hello Alice, your role is {{role}}.");
  });

  it("extracts defaults from placeholders", () => {
    const content = "Compare {{branch|master}} against {{path|src}}.";

    expect(extractTemplateVariables(content)).toEqual([
      { name: "branch", defaultValue: "master" },
      { name: "path", defaultValue: "src" },
    ]);
  });

  it("fills defaults when values are not provided", () => {
    const template = "Compare {{branch|master}} against {{path|src}}.";

    expect(fillTemplateVariables(template, new Map())).toBe(
      "Compare master against src.",
    );
  });

  it("supports optional dollar-prefixed placeholder names", () => {
    const template = "Compare {{$branch|master}} against {{$path|src}}.";

    expect(fillTemplateVariables(template, new Map())).toBe(
      "Compare master against src.",
    );
  });

  it("applies default from any occurrence to bare occurrences of the same variable", () => {
    const template = "Hello {{name}}, welcome back {{name|friend}}.";
    expect(fillTemplateVariables(template, new Map())).toBe(
      "Hello friend, welcome back friend.",
    );
  });

  it("treats empty default as empty string", () => {
    const template = "Hello {{name|}} world";
    expect(fillTemplateVariables(template, new Map())).toBe("Hello  world");
    expect(extractTemplateVariables(template)).toEqual([
      { name: "name", defaultValue: "" },
    ]);
  });
});

describe("isShellSafe", () => {
  it("returns true for simple alphanumeric values", () => {
    expect(isShellSafe("abc123")).toBe(true);
    expect(isShellSafe("my-file.txt")).toBe(true);
    expect(isShellSafe("./path/to/file")).toBe(true);
    expect(isShellSafe("user@host:port")).toBe(true);
  });

  it("returns false for values with spaces", () => {
    expect(isShellSafe("hello world")).toBe(false);
    expect(isShellSafe("Email Series - Rework/file.md")).toBe(false);
  });

  it("returns false for empty strings", () => {
    expect(isShellSafe("")).toBe(false);
  });

  it("returns false for values with shell metacharacters", () => {
    expect(isShellSafe("foo;bar")).toBe(false);
    expect(isShellSafe("$(cmd)")).toBe(false);
    expect(isShellSafe("a&b")).toBe(false);
    expect(isShellSafe("file*")).toBe(false);
    expect(isShellSafe("it's")).toBe(false);
    expect(isShellSafe('say "hi"')).toBe(false);
  });
});

describe("shellQuote", () => {
  it("wraps simple values in single quotes", () => {
    expect(shellQuote("hello world")).toBe("'hello world'");
  });

  it("escapes embedded single quotes with '\\'' idiom", () => {
    expect(shellQuote("it's here")).toBe("'it'\\''s here'");
  });

  it("handles empty strings", () => {
    expect(shellQuote("")).toBe("''");
  });

  it("handles values with multiple special characters", () => {
    expect(shellQuote('say "hello" & goodbye')).toBe("'say \"hello\" & goodbye'");
  });
});

describe("getQuoteContext", () => {
  it("returns 'none' for bare context", () => {
    expect(getQuoteContext("cmd X rest", 4)).toBe("none");
  });

  it("returns 'double' inside double quotes", () => {
    expect(getQuoteContext('echo "Hello X"', 13)).toBe("double");
  });

  it("returns 'single' inside single quotes", () => {
    expect(getQuoteContext("echo 'Hello X'", 13)).toBe("single");
  });

  it("returns 'none' after closed double quotes", () => {
    expect(getQuoteContext('echo "hi" X', 10)).toBe("none");
  });

  it("handles escaped quotes inside double-quoted context", () => {
    expect(getQuoteContext('echo "say \\"hi\\" X"', 18)).toBe("double");
  });

  it("is line-local — previous line quotes don't bleed", () => {
    const text = 'echo "hello"\ncmd X rest';
    // Position of X on line 2
    const pos = text.indexOf("X", text.indexOf("\n"));
    expect(getQuoteContext(text, pos)).toBe("none");
  });
});

describe("fillTemplateVariablesForShell", () => {
  it("passes through shell-safe values without quoting", () => {
    const template = "git diff {{file1}} {{file2}}";
    const values = new Map([["file1", "foo.txt"], ["file2", "bar.txt"]]);
    expect(fillTemplateVariablesForShell(template, values)).toBe(
      "git diff foo.txt bar.txt",
    );
  });

  it("quotes unsafe values in bare context", () => {
    const template = "git diff {{file1}} {{file2}}";
    const values = new Map([
      ["file1", "./Series-Info.md"],
      ["file2", "./Email Series - Rework/Series-Info.md"],
    ]);
    expect(fillTemplateVariablesForShell(template, values)).toBe(
      "git diff ./Series-Info.md './Email Series - Rework/Series-Info.md'",
    );
  });

  it("does NOT quote unsafe values inside double quotes", () => {
    const template = 'echo "Hello {{name}}, welcome"';
    const values = new Map([["name", "John Doe"]]);
    expect(fillTemplateVariablesForShell(template, values)).toBe(
      'echo "Hello John Doe, welcome"',
    );
  });

  it("does NOT quote unsafe values inside single quotes", () => {
    const template = "echo 'Deploy to {{env}} now'";
    const values = new Map([["env", "my server"]]);
    expect(fillTemplateVariablesForShell(template, values)).toBe(
      "echo 'Deploy to my server now'",
    );
  });

  it("quotes empty strings in bare context", () => {
    const template = "cmd {{arg}}";
    const values = new Map([["arg", ""]]);
    expect(fillTemplateVariablesForShell(template, values)).toBe("cmd ''");
  });

  it("escapes embedded single quotes when quoting", () => {
    const template = "cmd {{file}}";
    const values = new Map([["file", "it's a file"]]);
    expect(fillTemplateVariablesForShell(template, values)).toBe(
      "cmd 'it'\\''s a file'",
    );
  });

  it("leaves unfilled variables as-is", () => {
    const template = "cmd {{file1}} {{file2}}";
    const values = new Map([["file1", "hello world"]]);
    expect(fillTemplateVariablesForShell(template, values)).toBe(
      "cmd 'hello world' {{file2}}",
    );
  });

  it("uses defaults just like fillTemplateVariables", () => {
    const template = "git checkout {{branch|master}}";
    expect(fillTemplateVariablesForShell(template, new Map())).toBe(
      "git checkout master",
    );
  });
});

describe("extractCodeBlocks for templates", () => {
  it("extracts prompt code blocks", () => {
    const content = `\`\`\`prompt
Review this {{language}} code.
\`\`\``;

    const blocks = extractCodeBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("prompt");
    expect(blocks[0].code).toContain("{{language}}");
  });
});
