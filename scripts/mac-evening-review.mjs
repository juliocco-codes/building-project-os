import { spawnSync } from "node:child_process";
import { copyFileSync, constants, lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { localDate, readThreads, renderReview } from "../src/evening-review.mjs";

const label = "org.building-project-os.evening-review";
const fixture = fileURLToPath(new URL("../examples/evening-threads.json", import.meta.url));
const worker = fileURLToPath(new URL("../src/evening-review.mjs", import.meta.url));
const marker = "Building Project OS evening review v1\n";
const stat = path => lstatSync(path, { throwIfNoEntry: false });
const read = path => readFileSync(path, "utf8");
const create = (path, contents) => writeFileSync(path, contents, { flag: "wx", mode: 0o600 });

export function layout(home) {
  const data = join(home, "Library", "Application Support", "Building Project OS", "Evening Review");
  return {
    data, owner: join(data, ".starter"), worker: join(data, "worker.mjs"),
    input: join(data, "threads.json"), reports: join(data, "reports"), log: join(data, "errors.log"),
    receipt: join(data, "installed.plist"), plist: join(home, "Library", "LaunchAgents", label + ".plist"),
  };
}

export function jobPlist(paths, time, node = process.execPath) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a local time in HH:MM (24-hour format).");
  const [hour, minute] = time.split(":").map(Number);
  const xml = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const args = [node, paths.worker, paths.input, paths.reports].map(s => "    <string>" + xml(s) + "</string>").join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>
  <key>StandardErrorPath</key><string>${xml(paths.log)}</string>
</dict>
</plist>
`;
}

function checkOwner(paths) {
  if (!stat(paths.data)?.isDirectory() || !stat(paths.owner)?.isFile() || read(paths.owner) !== marker) {
    throw new Error("Unrecognized data folder. Inspect " + paths.data);
  }
}

export function prepare(paths, contents) {
  if (stat(paths.plist) || stat(paths.receipt)) throw new Error("Schedule files already exist. Check or uninstall the current schedule first.");
  if (!stat(paths.data)) {
    mkdirSync(dirname(paths.data), { recursive: true, mode: 0o700 });
    mkdirSync(paths.data, { mode: 0o700 });
    create(paths.owner, marker);
    copyFileSync(worker, paths.worker, constants.COPYFILE_EXCL);
    copyFileSync(fixture, paths.input, constants.COPYFILE_EXCL);
    mkdirSync(paths.reports, { mode: 0o700 });
  }
  checkOwner(paths);
  if (!stat(paths.worker)?.isFile() || read(paths.worker) !== read(worker) ||
      !stat(paths.input)?.isFile() || !stat(paths.reports)?.isDirectory()) {
    throw new Error("Installed files differ or are incomplete. Inspect the data folder before reinstalling.");
  }
  renderReview(readThreads(paths.input), localDate(new Date()));
  mkdirSync(dirname(paths.plist), { recursive: true, mode: 0o700 });
  create(paths.receipt, contents);
  try {
    create(paths.plist, contents);
  } catch (error) {
    unlinkSync(paths.receipt);
    throw error;
  }
}

function checkSchedule(paths) {
  checkOwner(paths);
  if (!stat(paths.receipt)?.isFile() || !stat(paths.plist)?.isFile() || read(paths.receipt) !== read(paths.plist)) {
    throw new Error("Schedule files are missing or differ. Inspect them before changing the job.");
  }
}

export function removeSchedule(paths, unload) {
  checkSchedule(paths);
  unload();
  unlinkSync(paths.plist);
  unlinkSync(paths.receipt);
}

export function installSchedule(paths, contents, register, inspect) {
  prepare(paths, contents);
  try {
    register();
  } catch (error) {
    // A registration error can follow acceptance. Only undo a confirmed unused schedule.
    let loaded;
    try {
      loaded = inspect();
    } catch {
      throw new Error(error.message + " Registration is uncertain; schedule files retained. Use check and uninstall.");
    }
    if (loaded !== null) {
      throw new Error(error.message + " A job is loaded; schedule files retained. Use check and uninstall.");
    }
    removeSchedule(paths, () => {});
    throw new Error(error.message + " Confirmed unloaded and removed the attempted schedule.");
  }
}

function launchctl(args, allowMissing = false) {
  const result = spawnSync("/bin/launchctl", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status === 0) return result.stdout;
  if (allowMissing && result.status === 113 && result.stderr.includes("Could not find service")) return null;
  throw new Error("launchctl " + args[0] + " failed: " + result.stderr.trim());
}

function main([command, time, input, ...extra]) {
  if (Number(process.versions.node.split(".")[0]) < 20) throw new Error("Use Node.js 20 or later.");
  const paths = layout(homedir());
  const scheduled = command === "install" || command === "preview";
  if (extra.length || (input && command !== "preview") || (!scheduled && time) ||
      !["preview", "install", "check", "run", "uninstall"].includes(command)) {
    throw new Error("Usage: preview HH:MM [source.json] | install HH:MM | check | run | uninstall");
  }
  const plist = scheduled && jobPlist(paths, time);
  if (command === "preview") {
    console.log("Daily at " + time + " local time. Reports: " + paths.reports + "\n");
    console.log(renderReview(readThreads(input ?? fixture), localDate(new Date())));
    return;
  }
  if (process.platform !== "darwin") throw new Error("Scheduling requires a Mac.");
  const domain = "gui/" + process.getuid();
  const service = domain + "/" + label;
  const loaded = launchctl(["print", service], true);
  if (command === "install") {
    if (loaded !== null) throw new Error("This job label is already loaded. Check the existing job.");
    installSchedule(paths, plist,
      () => launchctl(["bootstrap", domain, paths.plist]),
      () => launchctl(["print", service], true));
    console.log("Scheduled for " + time + " local time. Reports: " + paths.reports);
    return;
  }
  if (loaded !== null && !loaded.split("\n").some(line => line.trim() === "path = " + paths.plist)) {
    throw new Error("Another loaded job uses this label. Leaving it alone.");
  }
  if (command === "check") {
    console.log(loaded === null ? "Job is unloaded." : "Job is loaded.");
    for (const line of (loaded ?? "").split("\n")) {
      if (/^\t(state|runs|last exit code) =/.test(line)) console.log(line.trim());
    }
    const today = join(paths.reports, localDate(new Date()) + ".txt");
    console.log(stat(today)?.isFile() ? "Today's report: " + today : "Awaiting today's report: " + today);
  } else if (command === "run") {
    checkSchedule(paths);
    if (loaded === null) throw new Error("Job is unloaded.");
    launchctl(["kickstart", service]);
    console.log("Requested one run. Use check to see its outcome.");
  } else {
    removeSchedule(paths, () => {
      if (loaded !== null) launchctl(["bootout", domain, paths.plist]);
    });
    console.log("Removed the schedule. Your source, worker, reports and error log stay in " + paths.data);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
