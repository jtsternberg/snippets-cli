export interface TemplateVariable {
  name: string;
  defaultValue?: string;
}

const TEMPLATE_VARIABLE_REGEX = /\{\{\s*\$?(\w+)(?:\|([^}]*?))?\s*\}\}/g;

export function extractTemplateVariables(template: string): TemplateVariable[] {
  TEMPLATE_VARIABLE_REGEX.lastIndex = 0;
  const variables = new Map<string, TemplateVariable>();
  let match: RegExpExecArray | null;

  while ((match = TEMPLATE_VARIABLE_REGEX.exec(template)) !== null) {
    const name = match[1];
    const defaultValue = normalizeDefaultValue(match[2]);
    const existing = variables.get(name);

    if (!existing) {
      const variable: TemplateVariable = { name };
      if (defaultValue !== undefined) variable.defaultValue = defaultValue;
      variables.set(name, variable);
      continue;
    }

    if (existing.defaultValue === undefined && defaultValue !== undefined) {
      existing.defaultValue = defaultValue;
    }
  }

  return [...variables.values()];
}

export function fillTemplateVariables(
  template: string,
  values: Map<string, string>,
): string {
  // Build a per-variable defaults map so that if *any* occurrence of a
  // variable specifies a default (e.g. {{name|fallback}}), bare
  // occurrences ({{name}}) also resolve instead of being left as-is.
  const variableDefaults = new Map<string, string>();
  for (const v of extractTemplateVariables(template)) {
    if (v.defaultValue !== undefined) {
      variableDefaults.set(v.name, v.defaultValue);
    }
  }

  return template.replaceAll(TEMPLATE_VARIABLE_REGEX, (placeholder, name: string, defaultValue?: string) => {
    if (values.has(name)) {
      return values.get(name) ?? "";
    }

    const normalizedDefault = normalizeDefaultValue(defaultValue);
    if (normalizedDefault !== undefined) {
      return normalizedDefault;
    }

    // Fall back to a default defined on another occurrence of this variable
    if (variableDefaults.has(name)) {
      return variableDefaults.get(name)!;
    }

    return placeholder;
  });
}

function normalizeDefaultValue(defaultValue?: string): string | undefined {
  if (defaultValue === undefined) {
    return undefined;
  }

  return defaultValue.trim();
}

// --- Shell quoting utilities for safe template variable substitution ---

// Characters that are safe to use unquoted in POSIX shell argument positions.
const SHELL_SAFE = /^[a-zA-Z0-9._\-\/:@+,%~=]+$/;

/**
 * Returns true if the value can safely appear unquoted in a shell command.
 * Empty strings and strings with shell metacharacters need quoting.
 */
export function isShellSafe(value: string): boolean {
  return value.length > 0 && SHELL_SAFE.test(value);
}

/**
 * Wraps a value in POSIX single quotes, escaping embedded single quotes
 * using the standard '\'' idiom (end-quote, escaped-quote, start-quote).
 */
export function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export type QuoteContext = "double" | "single" | "none";

/**
 * Determines the shell quote context at a given position in a template string
 * by scanning from the start of the line containing that position.
 *
 * This is a line-local heuristic — it handles the vast majority of real-world
 * shell snippets (single-line commands, straightforward multi-line scripts)
 * but won't perfectly parse heredocs or multi-line string continuations.
 */
export function getQuoteContext(text: string, position: number): QuoteContext {
  const lineStart = text.lastIndexOf("\n", position - 1) + 1;
  const before = text.substring(lineStart, position);

  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < before.length; i++) {
    const ch = before[i];
    // Backslash escapes the next character (only outside single quotes)
    if (ch === "\\" && !inSingle) {
      i++;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    }
  }

  if (inDouble) return "double";
  if (inSingle) return "single";
  return "none";
}

/**
 * Context-aware variant of fillTemplateVariables for shell scripts.
 *
 * Rules:
 * 1. Shell-safe values (alphanumeric + common safe chars) pass through raw.
 * 2. Unsafe values inside double/single quote context pass through raw
 *    (the enclosing quotes already handle word-splitting protection).
 * 3. Unsafe values in bare (unquoted) context get single-quoted.
 */
export function fillTemplateVariablesForShell(
  template: string,
  values: Map<string, string>,
): string {
  const variableDefaults = new Map<string, string>();
  for (const v of extractTemplateVariables(template)) {
    if (v.defaultValue !== undefined) {
      variableDefaults.set(v.name, v.defaultValue);
    }
  }

  return template.replaceAll(
    TEMPLATE_VARIABLE_REGEX,
    (placeholder: string, name: string, defaultValue: string | undefined, offset: number, originalString: string) => {
      let value: string | undefined;

      if (values.has(name)) {
        value = values.get(name) ?? "";
      } else {
        const normalizedDefault = normalizeDefaultValue(defaultValue);
        if (normalizedDefault !== undefined) {
          value = normalizedDefault;
        } else if (variableDefaults.has(name)) {
          value = variableDefaults.get(name)!;
        }
      }

      if (value === undefined) {
        return placeholder;
      }

      // Shell-safe values never need quoting
      if (isShellSafe(value)) {
        return value;
      }

      // Unsafe values in a quoted context don't need extra quoting
      if (getQuoteContext(originalString, offset) !== "none") {
        return value;
      }

      // Bare context + unsafe value → shell-quote it
      return shellQuote(value);
    },
  );
}
