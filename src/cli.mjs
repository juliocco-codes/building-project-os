#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dispatchDecision, validateTask } from "./project-os.mjs";

const [command, file] = process.argv.slice(2);
if (!command || !file || !["validate", "dispatch"].includes(command)) {
  console.error("Usage: node src/cli.mjs <validate|dispatch> <task.json>");
  process.exit(1);
}

const task = JSON.parse(await readFile(file, "utf8"));
const output = command === "validate"
  ? { valid: validateTask(task).length === 0, errors: validateTask(task) }
  : dispatchDecision(task);

console.log(JSON.stringify(output, null, 2));
if (command === "validate" && !output.valid) process.exitCode = 1;
