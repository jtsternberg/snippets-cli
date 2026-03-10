import type { Snippet } from "../types/index.js";
import { extractCopyContent } from "./frontmatter.js";

interface AlfredItem {
  uid: string;
  title: string;
  subtitle: string;
  arg: string;
  autocomplete: string;
  icon?: { type?: string; path: string };
  mods: {
    cmd: { subtitle: string; arg: string };
    alt: { subtitle: string; arg: string };
    ctrl: { subtitle: string; arg: string };
  };
  text: { copy: string; largetype: string };
  quicklookurl: string;
  variables: Record<string, string>;
}

interface AlfredOutput {
  items: AlfredItem[];
}

// Maps snippet language names to file extensions so Alfred can show the
// system's icon for that language (e.g. Python's .py icon, JS's .js icon).
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  bash: ".sh",
  c: ".c",
  "c#": ".cs",
  "c++": ".cpp",
  cpp: ".cpp",
  csharp: ".cs",
  css: ".css",
  fish: ".fish",
  go: ".go",
  html: ".html",
  java: ".java",
  javascript: ".js",
  json: ".json",
  kotlin: ".kt",
  markdown: ".md",
  php: ".php",
  python: ".py",
  ruby: ".rb",
  rust: ".rs",
  shell: ".sh",
  sql: ".sql",
  swift: ".swift",
  toml: ".toml",
  typescript: ".ts",
  yaml: ".yaml",
  yml: ".yaml",
  zsh: ".zsh",
};

function languageIcon(language: string | undefined, filePath: string): { type?: string; path: string } {
  const ext = language ? LANGUAGE_EXTENSIONS[language.toLowerCase()] : undefined;
  if (ext) {
    return { type: "filetype", path: ext };
  }
  return { type: "fileicon", path: filePath };
}

export function formatAlfredResults(snippets: Snippet[]): AlfredOutput {
  return {
    items: snippets.map((s) => {
      const codeContent = extractCopyContent(s);
      const tagStr = s.frontmatter.tags.length
        ? `tags: ${s.frontmatter.tags.join(", ")}`
        : "";
      const subtitle = [s.frontmatter.language, tagStr]
        .filter(Boolean)
        .join(" | ");

      return {
        uid: `${s.frontmatter.type}/${s.slug}`,
        title: s.frontmatter.title || s.slug,
        subtitle,
        arg: codeContent,
        autocomplete: s.frontmatter.title || s.slug,
        icon: languageIcon(s.frontmatter.language, s.filePath),
        mods: {
          cmd: { subtitle: "Copy to clipboard", arg: codeContent },
          alt: { subtitle: "Open in editor", arg: s.filePath },
          ctrl: { subtitle: "Reveal in Finder", arg: s.filePath },
        },
        text: { copy: codeContent, largetype: codeContent },
        quicklookurl: s.filePath,
        variables: {
          snippet_slug: s.slug,
          snippet_type: s.frontmatter.type,
        },
      };
    }),
  };
}

export function formatAlfredError(message: string): AlfredOutput {
  return {
    items: [
      {
        uid: "error",
        title: "Error",
        subtitle: message,
        arg: "",
        autocomplete: "",
        mods: {
          cmd: { subtitle: message, arg: "" },
          alt: { subtitle: message, arg: "" },
          ctrl: { subtitle: message, arg: "" },
        },
        text: { copy: message, largetype: message },
        quicklookurl: "",
        variables: {},
      },
    ],
  };
}
