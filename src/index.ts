import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { showCommand } from "./commands/show.js";
import { copyCommand } from "./commands/copy.js";
import { editCommand } from "./commands/edit.js";
import { rmCommand } from "./commands/rm.js";
import { listCommand } from "./commands/list.js";
import { tagsCommand } from "./commands/tags.js";
import { configCommand, configTypesAddCommand } from "./commands/config.js";
import { renameCommand } from "./commands/rename.js";
import { searchCommand } from "./commands/search.js";
import { findCommand } from "./commands/find.js";
import { doctorCommand } from "./commands/doctor.js";
import { runCommand } from "./commands/run.js";
import { linkCommand } from "./commands/link.js";
import { createInstallCommand } from "./commands/install.js";

const program = new Command();

program
  .name("snip")
  .description("CLI snippet manager with semantic search and Obsidian-compatible storage")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(showCommand);
program.addCommand(copyCommand);
program.addCommand(editCommand);
program.addCommand(rmCommand);
program.addCommand(listCommand);
program.addCommand(tagsCommand);
program.addCommand(configCommand);
program.addCommand(configTypesAddCommand);
program.addCommand(renameCommand);
program.addCommand(searchCommand);
program.addCommand(findCommand);
program.addCommand(doctorCommand);
program.addCommand(runCommand);
program.addCommand(linkCommand);
program.addCommand(createInstallCommand(program));

program.parseAsync(process.argv);
