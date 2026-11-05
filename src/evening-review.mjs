import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readMirrorConfig, renderMirror } from "./whatsapp-mirror.mjs";

export function localDate(date) {
  const pad = n => String(n).padStart(2, "0");
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

function singleLine(value) {
  return typeof value === "string" && value.trim() && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value);
}

export function renderReview(source, day) {
  if (!Array.isArray(source)) throw new Error("Expected an array of threads.");
  const sections = { open: [], closed: [] };
  for (const [index, thread] of source.entries()) {
    if (!["open", "closed"].includes(thread?.status) || !singleLine(thread.title) || !singleLine(thread.note)) {
      throw new Error("Thread " + (index + 1) + " needs status open or closed and a single-line title and note.");
    }
    sections[thread.status].push("- " + thread.title.trim() + ": " + thread.note.trim());
  }
  const lines = ["Evening review | " + day];
  for (const [status, items] of Object.entries(sections)) {
    const heading = status === "open" ? "Open" : "Closed";
    lines.push("", heading + " (" + items.length + ")", items.length ? items.join("\n") : "(none)");
  }
  return lines.join("\n") + "\n";
}

export function readThreads(path) {
  const source = readFileSync(path, "utf8");
  try {
    return JSON.parse(source);
  } catch {
    throw new Error("The thread source contains invalid JSON.");
  }
}

export function writeReview(input, reports, now = new Date(), mirrorConfig) {
  const day = localDate(now);
  const report = renderReview(readThreads(input), day) + (mirrorConfig ? renderMirror(readMirrorConfig(mirrorConfig, now)) : "");
  const destination = join(reports, day + ".txt");
  const temp = join(reports, "." + randomUUID() + ".tmp");
  writeFileSync(temp, report, { flag: "wx", mode: 0o600 });
  try {
    renameSync(temp, destination);
  } catch (error) {
    unlinkSync(temp);
    throw error;
  }
  return destination;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    writeReview(process.argv[2], process.argv[3], new Date(), process.argv[4]);
  } catch (error) {
    console.error(new Date().toISOString() + " Evening review failed: " + error.message);
    process.exitCode = 1;
  }
}
