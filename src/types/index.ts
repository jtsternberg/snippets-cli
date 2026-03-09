export interface SnippetFrontmatter {
  title: string;
  description: string;
  tags: string[];
  aliases: string[];
  language: string;
  type: string;
  date: string;
  modified: string;
  source: string;
  related: string[];
  variables: string[];
}

export interface Snippet {
  frontmatter: SnippetFrontmatter;
  content: string;
  body: string;
  filePath: string;
  slug: string;
}

export interface LlmConfig {
  provider: string;
  ollamaModel: string;
  ollamaHost: string;
  fallbackProvider: string | null;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
}

export interface QmdConfig {
  collectionName: string;
}

export interface AlfredConfig {
  maxResults: number;
}

export interface SnipConfig {
  libraryPath: string;
  types: string[];
  defaultType: string;
  editor: string;
  llm: LlmConfig;
  qmd: QmdConfig;
  alfred: AlfredConfig;
}

export interface ResolveResult {
  snippet: Snippet;
  matchType: "exact" | "prefix" | "alias" | "fuzzy";
}

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  NOT_FOUND: 2,
  CONFIG_ERROR: 3,
  EXTERNAL_TOOL_ERROR: 4,
} as const;
