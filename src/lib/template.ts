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
