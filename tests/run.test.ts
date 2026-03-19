import { describe, it, expect } from "vitest";
import { extractCodeBlocks } from "../src/lib/frontmatter.js";
import { extractTemplateVariables, fillTemplateVariables } from "../src/lib/template.js";

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
