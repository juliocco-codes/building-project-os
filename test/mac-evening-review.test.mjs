import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { installSchedule, jobPlist, layout, prepare, removeSchedule } from "../scripts/mac-evening-review.mjs";
import { writeReview } from "../src/evening-review.mjs";

function staged(t) {
  const home = mkdtempSync(join(tmpdir(), "example & review-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const paths = layout(home);
  const plist = jobPlist(paths, "00:05");
  return { paths, plist };
}

test("stages an escaped argument array, calendar time and valid Mac plist", t => {
  const { paths, plist } = staged(t);
  for (const invalid of ["24:59", "9:00", "12:60", undefined]) assert.throws(() => jobPlist(paths, invalid));
  prepare(paths, plist);
  assert.match(plist, /example &amp; review-/);
  assert.match(plist, /<key>Hour<\/key><integer>0<\/integer><key>Minute<\/key><integer>5<\/integer>/);
  if (process.platform === "darwin") {
    const result = spawnSync("/usr/bin/plutil", ["-lint", paths.plist], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test("one complete file per local day; a failed read preserves the last good report", t => {
  const { paths, plist } = staged(t);
  prepare(paths, plist);
  const now = new Date(2032, 0, 5, 23, 50);
  const report = writeReview(paths.input, paths.reports, now);
  assert.match(readFileSync(report, "utf8"), /Open \(1\)[\s\S]*Trail map proof[\s\S]*Closed \(1\)[\s\S]*Workshop room/);
  writeFileSync(paths.input, "[]");
  assert.equal(writeReview(paths.input, paths.reports, now), report);
  assert.deepEqual(readdirSync(paths.reports), ["2032-01-05.txt"]);
  const empty = readFileSync(report, "utf8");
  assert.match(empty, /Open \(0\)[\s\S]*Closed \(0\)/);
  for (const invalid of ["private-sentinel", '[{"status":"maybe"}]']) {
    writeFileSync(paths.input, invalid);
    assert.throws(() => writeReview(paths.input, paths.reports, now));
    assert.equal(readFileSync(report, "utf8"), empty);
  }
  writeFileSync(paths.input, "private-sentinel");
  const result = spawnSync(process.execPath, [paths.worker, paths.input, paths.reports], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /private-sentinel/);
});

test("refuses conflicting file or failed unload, preserves source and reports across reinstall", t => {
  const { paths, plist } = staged(t);
  prepare(paths, plist);
  writeFileSync(paths.input, "[]");
  const report = writeReview(paths.input, paths.reports);
  assert.throws(() => prepare(paths, plist), /already exist/);
  writeFileSync(paths.plist, "another job");
  assert.throws(() => removeSchedule(paths, () => assert.fail("unexpected unload")), /differ/);
  assert.equal(readFileSync(paths.plist, "utf8"), "another job");
  writeFileSync(paths.plist, plist);
  assert.throws(() => removeSchedule(paths, () => { throw new Error("unload failed"); }), /unload failed/);
  assert.ok(existsSync(paths.plist));
  removeSchedule(paths, () => {});
  assert.equal(existsSync(paths.plist), false);
  assert.equal(existsSync(paths.receipt), false);
  prepare(paths, jobPlist(paths, "23:59"));
  assert.equal(readFileSync(paths.input, "utf8"), "[]");
  assert.ok(existsSync(report));
});

test("bootstrap failure removes only a confirmed unused schedule", t => {
  const { paths, plist } = staged(t);
  const fail = () => { throw new Error("bootstrap failed"); };
  assert.throws(() => installSchedule(paths, plist, fail, () => null), /Confirmed unloaded/);
  assert.equal(existsSync(paths.plist), false);
  assert.equal(existsSync(paths.receipt), false);
  assert.throws(() => installSchedule(paths, plist, fail, fail), /uncertain/);
  assert.ok(existsSync(paths.plist));
});
