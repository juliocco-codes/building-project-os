import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmdirSync,
  openSync, closeSync, fsyncSync } from "node:fs";
import { join } from "node:path";

export const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const read = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));

// Atomic replacement on a local filesystem; this is not a distributed transaction.
export function write(dir, name, value) {
  const target = join(dir, `${name}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fsyncSync(fd); }
  finally { closeSync(fd); }
  renameSync(temporary, target);
  const directory = openSync(dir, "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

export function locked(dir, action) {
  const lock = join(dir, ".lock");
  try { mkdirSync(lock); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("Workspace locked. Verify the owner has exited before removing .lock; see the recovery guide.");
    throw error;
  }
  try { return action(); } finally { rmdirSync(lock); }
}
