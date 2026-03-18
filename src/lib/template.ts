export interface TemplateVariable {
  name: string;
  defaultValue?: string;
}

const TEMPLATE_VARIABLE_REGEX = /\{\{\s*\$?(\w+)(?:\|([^}]*?))?\s*\}\}/g;

export function extractTemplateVariables(template: string): TemplateVariable[] {
  const variables = new Map<string, TemplateVariable>();
  let match: RegExpExecArray | null;

  while ((match = TEMPLATE_VARIABLE_REGEX.exec(template)) !== null) {
    const name = match[1];
    const defaultValue = normalizeDefaultValue(match[2]);
    const existing = variables.get(name);

    if (!existing) {
      variables.set(name, { name, ...(defaultValue !== undefined ? { defaultValue } : {}) });
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
  return template.replaceAll(TEMPLATE_VARIABLE_REGEX, (placeholder, name: string, defaultValue?: string) => {
    if (values.has(name)) {
      return values.get(name) ?? "";
    }

    const normalizedDefault = normalizeDefaultValue(defaultValue);
    if (normalizedDefault !== undefined) {
      return normalizedDefault;
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
