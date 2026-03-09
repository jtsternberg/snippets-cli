import { describe, it, expect } from "vitest";
import { extractCodeBlocks } from "../src/lib/frontmatter.js";

describe("template variable extraction", () => {
  it("extracts {{variables}} from template content", () => {
    const content = `Review the following {{language}} code with focus on {{focus_area}}.`;
    const regex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.add(match[1]);
    }

    expect(vars).toEqual(new Set(["language", "focus_area"]));
  });

  it("handles templates with no variables", () => {
    const content = `This is a static prompt with no variables.`;
    const regex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.add(match[1]);
    }

    expect(vars.size).toBe(0);
  });

  it("handles repeated variables", () => {
    const content = `Hello {{name}}, welcome {{name}}! Your role is {{role}}.`;
    const regex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.add(match[1]);
    }

    expect(vars).toEqual(new Set(["name", "role"]));
  });

  it("fills template variables correctly", () => {
    let template = `Review the following {{language}} code with focus on {{focus_area}}.`;
    const vars = new Map([
      ["language", "python"],
      ["focus_area", "security"],
    ]);

    for (const [key, value] of vars) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    expect(template).toBe(
      "Review the following python code with focus on security.",
    );
  });

  it("leaves unfilled variables as-is when not provided", () => {
    let template = `Hello {{name}}, your role is {{role}}.`;
    const vars = new Map([["name", "Alice"]]);

    for (const [key, value] of vars) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    expect(template).toBe("Hello Alice, your role is {{role}}.");
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
