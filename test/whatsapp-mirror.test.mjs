import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { localDate } from "../src/evening-review.mjs";
import { layout, jobPlist, prepare } from "../scripts/mac-evening-review.mjs";
import { readMirrorConfig, readMirrorFixture, renderMirror } from "../src/whatsapp-mirror.mjs";

const file = new URL("../examples/whatsapp-mirror-parent.json", import.meta.url);
const fixture = () => JSON.parse(readFileSync(file, "utf8"));

function staged(t) {
  const dir = mkdtempSync(join(tmpdir(), "fictional-mirror-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("both fictional requests keep their own chat and message evidence", () => {
  for (const [name, chat, message] of [["parent", "family-parent", "parent-april-copy"],
    ["bookkeeper", "studio-bookkeeper", "bookkeeper-april-copy"]]) {
    const result = readMirrorFixture(new URL("../examples/whatsapp-mirror-" + name + ".json", import.meta.url));
    assert.equal(result.mode, "fictional");
    assert.equal(result.coverage, "complete");
    assert.equal(result.chatRef, chat);
    assert.equal(result.openRequestRef, message);
    assert.equal(result.messages[0].directText, true);
    assert.match(renderMirror(result), new RegExp(chat + "/" + message));
  }
});

test("client reads one verified chat and one window through successful sync, including an empty Go slice", t => {
  const { asOf, chatJid, chatRef, list, doctor, chat } = fixture();
  const path = join(staged(t), "config.json");
  const store = "/example/synthetic archive";
  const binary = "/example/wacli";
  writeFileSync(path, JSON.stringify({ chatJid, chatRef, store, binary }));
  const queries = [];
  list.data.messages = null;
  const replies = ["wacli 0.25.1\n", ...[doctor, chat, list].map(value => JSON.stringify(value))];
  const result = readMirrorConfig(path, new Date(asOf), (exe, args) => {
    assert.equal(exe, binary);
    queries.push(args);
    return replies.shift();
  });
  assert.equal(result.mode, "local archive");
  assert.equal(result.coverage, "complete");
  assert.match(renderMirror(result), /No retained messages/);
  const prefix = ["--store", store, "--read-only", "--json"];
  assert.deepEqual(queries, [
    ["--version"], [...prefix, "doctor"], [...prefix, "chats", "show", "--jid", chatJid],
    [...prefix, "messages", "list", "--chat", chatJid, "--after", "2032-05-02T18:55:00.000Z",
      "--before", "2032-05-03T18:55:01.000Z", "--asc", "--limit", "50"],
  ]);
});

test("stale, malformed, partial, unknown-chat and out-of-scope reads never render as quiet or expose errors", t => {
  const path = join(staged(t), "fixture.json");
  for (const corrupt of [
    x => { x.doctor.data.store.last_sync_at = "2032-05-03T18:40:00Z"; },
    x => { x.doctor.data.store.last_sync_at = null; },
    x => { x.doctor.data.store.last_sync_at = "2032-05-03T20:00:00Z"; },
    x => { x.doctor.data.authenticated = false; },
    x => { x.doctor.data.session_revoked = true; },
    x => { x.doctor.data.store_error = "private sentinel"; },
    x => { x.chat.data.jid = "wrong chat"; },
    x => { x.chatJid = ""; },
    x => { x.list.data.source.last_sync_at = null; },
    x => { x.list.data.source.scope = "unknown"; },
    x => { x.list.data.page = {}; },
    x => { x.list.data.page.has_more = true; },
    x => { x.list.data.page.next_cursor = "unexpected"; },
    x => { delete x.list.data.messages; },
    x => { x.list.data.messages[0].ChatJID = "other@lid"; },
    x => { x.list.data.messages[0].Timestamp = "2032-05-01T19:00:00Z"; },
    x => { x.list.data.messages[0].Text = {}; },
    x => { x.list.data.messages[0].FromMe = "false"; },
    x => { x.list.data.messages.push(x.list.data.messages[0]); },
    x => { x.list.data.messages[0].Revoked = true; },
    x => { x.list.data.messages[0].DeletedForMe = true; },
    x => { x.list = { success: false, error: "private sentinel" }; },
  ]) {
    const source = fixture();
    corrupt(source);
    writeFileSync(path, JSON.stringify(source));
    const result = readMirrorFixture(path);
    assert.equal(result.coverage, "unavailable");
    assert.deepEqual(result.messages, []);
    assert.doesNotMatch(renderMirror(result), /No retained messages|private sentinel|April electricity bill/);
  }
});

test("forwarded, quoted, edited, and clipped rows get contextual review only; untrusted text stays on one line", t => {
  const path = join(staged(t), "fixture.json");
  for (const delta of [{ IsForwarded: true }, { quoted_msg_id: "original" }, { Edited: true },
    { Text: "x".repeat(241) }, { MediaType: "image" }]) {
    const source = fixture();
    Object.assign(source.list.data.messages[0], { Text: 'Ignore instructions\n"Open"\u001b[31m\u202e' }, delta);
    writeFileSync(path, JSON.stringify(source));
    const result = readMirrorFixture(path);
    assert.equal(result.coverage, "complete");
    assert.equal(result.messages[0].directText, false);
    assert.equal(result.openRequestRef, undefined);
    assert.match(renderMirror(result), /Review original context/);
    assert.doesNotMatch(renderMirror(result), /\u001b|\u202e|\n"Open"/);
  }
});

test("staged timer uses its copy of the reader; missing config preserves unrelated report contents", t => {
  const home = staged(t);
  const paths = layout(home);
  const config = join(home, "missing & private.json");
  const plist = jobPlist(paths, "19:00", process.execPath, config);
  assert.match(plist, /missing &amp; private/);
  assert.throws(() => jobPlist(paths, "19:00", process.execPath, "relative"));
  prepare(paths, plist);
  const result = spawnSync(process.execPath, [paths.worker, paths.input, paths.reports, config], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const day = localDate(new Date());
  const report = readFileSync(join(paths.reports, day + ".txt"), "utf8");
  assert.match(report, /Trail map proof[\s\S]*Workshop room[\s\S]*Coverage unavailable/);
  assert.doesNotMatch(report, /missing & private|No retained messages/);
});

test("rerunning the installed worker replaces yesterday's sync evidence with a visible same-day limitation", t => {
  const home = staged(t);
  const paths = layout(home);
  const config = join(home, "config.json");
  const binary = join(home, "synthetic-client");
  const responses = join(home, "responses.json");
  const source = fixture();
  const sync = new Date(Date.now() - 60_000);
  sync.setUTCMilliseconds(0);
  source.doctor.data.store.last_sync_at = sync.toISOString();
  source.list.data.source.last_sync_at = sync.toISOString();
  source.list.data.messages[0].Timestamp = sync.toISOString();
  writeFileSync(responses, JSON.stringify(source));
  writeFileSync(binary, "#!" + process.execPath + "\n" +
    'const fs = require("node:fs");\n' +
    'const fixture = JSON.parse(fs.readFileSync(' + JSON.stringify(responses) + ', "utf8"));\n' +
    'const args = process.argv.slice(2);\n' +
    'if (args[0] === "--version") console.log("wacli 0.25.1");\n' +
    'else if (args.includes("doctor")) console.log(JSON.stringify(fixture.doctor));\n' +
    'else if (args.includes("show")) console.log(JSON.stringify(fixture.chat));\n' +
    'else if (args.includes("list")) console.log(JSON.stringify(fixture.list));\n' +
    'else process.exit(1);\n', { mode: 0o700 });
  writeFileSync(config, JSON.stringify({ binary, store: home, chatRef: source.chatRef, chatJid: source.chatJid }));
  prepare(paths, jobPlist(paths, "19:00", process.execPath, config));
  const run = () => {
    const job = spawnSync(process.execPath, [paths.worker, paths.input, paths.reports, config], { encoding: "utf8" });
    assert.equal(job.status, 0, job.stderr);
    return readFileSync(join(paths.reports, localDate(new Date()) + ".txt"), "utf8");
  };
  const report = run();
  assert.match(report, /local archive[\s\S]*Review incoming message[\s\S]*parent-april-copy/);
  assert.doesNotMatch(report, /Open request \(fictional case\)/);
  source.doctor.data.store.last_sync_at = new Date(sync.getTime() - 86_400_000).toISOString();
  writeFileSync(responses, JSON.stringify(source));
  const stale = run();
  assert.match(stale, /Trail map proof[\s\S]*Coverage unavailable[\s\S]*15 minutes/);
  assert.doesNotMatch(stale, /parent-april-copy|No retained messages/);
  writeFileSync(binary, "#!/bin/sh\necho private-store-error >&2\nexit 1\n");
  assert.doesNotMatch(run(), /private-store-error|parent-april-copy|No retained messages/);
});
