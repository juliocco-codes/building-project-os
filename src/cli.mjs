#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dispatchDecision, validateTask } from "./project-os.mjs";
import { runWeeklyReview } from "./weekly-review.mjs";

const [command, file, ...args] = process.argv.slice(2);
try {
  if (command === "weekly") {
    const [directory, ...options] = args;
    if (!file || !directory) throw new Error("Usage: node src/cli.mjs weekly <init|review|late|approve|deliver|status> <directory> [approval arguments | --crash-before-provider | --crash-after-provider]");
    const crashAfterProvider = file === "deliver" && options.length === 1 && options[0] === "--crash-after-provider";
    const crashBeforeProvider = file === "deliver" && options.length === 1 && options[0] === "--crash-before-provider";
    console.log(JSON.stringify(runWeeklyReview(file, directory, crashAfterProvider || crashBeforeProvider ? [] : options, { crashAfterProvider, crashBeforeProvider }), null, 2));
  } else {
    if (!command || !file || args.length || !["validate", "dispatch"].includes(command)) {
      throw new Error("Usage: node src/cli.mjs <validate|dispatch> <task.json> OR weekly <command> <directory>");
    }

    const task = JSON.parse(await readFile(file, "utf8"));
    const output = command === "validate"
      ? { valid: validateTask(task).length === 0, errors: validateTask(task) }
      : dispatchDecision(task);

    console.log(JSON.stringify(output, null, 2));
    if (command === "validate" && !output.valid) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
