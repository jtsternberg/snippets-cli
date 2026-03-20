import { Command } from "commander";
import { ensureQmd, updateAndEmbed } from "../lib/qmd.js";
import { EXIT_CODES } from "../types/index.js";

export const reindexCommand = new Command("reindex")
  .description("Re-index snippets for qmd semantic search")
  .action(async () => {
    if (!(await ensureQmd())) {
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    console.log("Re-indexing snippets...");
    await updateAndEmbed();
    console.log("Done.");
  });
