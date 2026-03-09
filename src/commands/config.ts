import { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  configExists,
  getLibraryPath,
} from "../lib/config.js";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { EXIT_CODES } from "../types/index.js";

export const configCommand = new Command("config")
  .description("View or modify configuration")
  .argument("[key]", "Config key to get or set")
  .argument("[value]", "Value to set")
  .option("--json", "Output full config as JSON")
  .action(async (key: string | undefined, value: string | undefined, opts: { json?: boolean }) => {
    if (!configExists()) {
      console.error("No config found. Run `snip init` first.");
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }

    const config = loadConfig();

    // Show full config
    if (!key || opts.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    // Handle special "types" subcommands
    if (key === "types") {
      if (!value) {
        console.log(config.types.join("\n"));
        return;
      }

      // "types add <name>" or "types remove <name>"
      // The value here would be "add" and we'd need a third arg
      // For simplicity, just show types if no subcommand
      console.log(config.types.join("\n"));
      return;
    }

    // Get a config value
    if (!value) {
      const val = getNestedValue(config as unknown as Record<string, unknown>, key);
      if (val === undefined) {
        console.error(`Unknown config key: ${key}`);
        process.exit(EXIT_CODES.CONFIG_ERROR);
      }
      console.log(typeof val === "object" ? JSON.stringify(val, null, 2) : String(val));
      return;
    }

    // Set a config value
    setNestedValue(config as unknown as Record<string, unknown>, key, value);
    saveConfig(config);
    console.log(`Set ${key} = ${value}`);
  });

// Subcommand for adding types
export const configTypesAddCommand = new Command("config:types:add")
  .description("Add a new snippet type directory")
  .argument("<name>", "Type name to add")
  .action(async (name: string) => {
    const config = loadConfig();

    if (config.types.includes(name)) {
      console.log(`Type "${name}" already exists.`);
      return;
    }

    config.types.push(name);
    saveConfig(config);

    // Create the directory
    const typeDir = resolve(getLibraryPath(config), name);
    mkdirSync(typeDir, { recursive: true });

    console.log(`Added type "${name}" and created ${typeDir}/`);
  });

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];

  // Try to preserve types
  const existing = current[lastKey];
  if (typeof existing === "number") {
    current[lastKey] = Number(value);
  } else if (typeof existing === "boolean") {
    current[lastKey] = value === "true";
  } else {
    current[lastKey] = value;
  }
}
