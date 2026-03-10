import chalk from "chalk";

/** Whether stdout is a TTY — skip colors when piped */
const isTTY = process.stdout.isTTY ?? false;

/** Wrap chalk so it's a no-op when piped */
function c<T extends (...args: string[]) => string>(fn: T): T {
  if (isTTY) return fn;
  return ((...args: string[]) => args.join("")) as unknown as T;
}

// Reusable styled formatters (no-op when piped)
export const fmt = {
  bold: c(chalk.bold),
  dim: c(chalk.dim),
  green: c(chalk.green),
  red: c(chalk.red),
  yellow: c(chalk.yellow),
  cyan: c(chalk.cyan),
  magenta: c(chalk.magenta),
  blueBright: c(chalk.blueBright),
  greenBold: c((s: string) => chalk.green.bold(s)),
  redBold: c((s: string) => chalk.red.bold(s)),
  yellowBold: c((s: string) => chalk.yellow.bold(s)),
};

/** Format a snippet line for list/find/search output */
export function formatSnippetLine(
  slug: string,
  title: string,
  language?: string,
  tags?: string[],
): string {
  const langPart = language ? ` ${fmt.dim(`(${language})`)}` : "";
  const tagsPart = tags?.length ? ` ${fmt.cyan(`[${tags.join(", ")}]`)}` : "";
  return `${fmt.bold(slug)}${langPart}${tagsPart} ${fmt.dim("—")} ${title}`;
}

/** Format a count summary like "6 snippet(s)" */
export function formatCount(count: number, noun: string): string {
  return fmt.dim(`${count} ${noun}(s)`);
}

/** Doctor-style status prefixes */
export const status = {
  ok: (msg: string) => `  ${fmt.green("OK")}  ${msg}`,
  warn: (msg: string) => `  ${fmt.redBold("!!")}  ${msg}`,
  info: (msg: string) => `  ${fmt.dim("--")}  ${msg}`,
};
