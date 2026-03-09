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
        icon: { type: "fileicon", path: s.filePath },
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
