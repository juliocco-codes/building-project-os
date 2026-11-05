import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { familyEveningReview, replyCommand } from "../src/whatsapp-reply.mjs";

const file = name => fileURLToPath(new URL("../examples/" + name, import.meta.url));
function exercise(t) {
  const home = mkdtempSync(join(tmpdir(), "fictional-replies-"));
  t.after(() => rmSync(home, { force: true, recursive: true }));
  const dir = join(home, "replies");
  const fixture = join(home, "selected.json");
  copyFileSync(file("whatsapp-mirror-parent.json"), fixture);
  const run = (command, name, ...args) => replyCommand(command, dir, name, args);
  run("init");
  return { dir, fixture, run, parent: (command, ...args) => run(command, "parent", ...args) };
}

test("two distinct requests use their own writing samples and approvals for the same bill", t => {
  const { run, fixture } = exercise(t);
  const parent = run("draft", "parent", fixture);
  const book = run("draft", "bookkeeper", file("whatsapp-mirror-bookkeeper.json"));
  assert.deepEqual(parent.payload.attachment, book.payload.attachment);
  assert.notEqual(parent.previouslyApprovedExample, book.previouslyApprovedExample);
  assert.match(parent.payload.text, /Mom/);
  assert.match(book.payload.text, /PF-APR/);
  assert.throws(() => run("approve", "bookkeeper", parent.previewId, "--mock-send"));
  assert.throws(() => run("send", "parent"));
  run("approve", "parent", parent.previewId, "--mock-send");
  assert.equal(run("send", "parent").requestStatus, "open");
  assert.throws(() => run("send", "bookkeeper"));
});

test("explicit edits, cancel and replacement require fresh approval", t => {
  const { parent, fixture } = exercise(t);
  let current = parent("draft", fixture);
  for (const [field, value] of [["text", "Thanks, Mom!"], ["attachment", "none"], ["attachment", "bill"]]) {
    if (current.payload.attachment) parent("approve", current.previewId, "--mock-send");
    else assert.throws(() => parent("approve", current.previewId, "--mock-send"), /requires the reviewed attachment/);
    const updated = parent("edit", field, value);
    assert.notEqual(updated.previewId, current.previewId);
    assert.throws(() => parent("approve", current.previewId, "--mock-send"));
    assert.throws(() => parent("send"));
    current = updated;
  }
  parent("approve", current.previewId, "--mock-send");
  const changed = parent("edit", "recipient", "studio-bookkeeper");
  assert.throws(() => parent("approve", changed.previewId, "--mock-send"));
  assert.throws(() => parent("send"));
  current = parent("edit", "recipient", "family-parent");
  parent("approve", current.previewId, "--mock-send");
  parent("cancel");
  assert.throws(() => parent("approve", current.previewId, "--mock-send"));
  assert.throws(() => parent("send"));
  assert.equal(parent("status").mockProviderReceipt, null);
});

test("incomplete, substituted, wrong-direction, ambiguous and superseded source cannot produce a draft", t => {
  const { parent, run, fixture } = exercise(t);
  assert.throws(() => run("draft", "Mom", fixture));
  assert.throws(() => parent("draft", file("whatsapp-mirror-bookkeeper.json")));
  const original = readFileSync(fixture, "utf8");
  for (const mutate of [
    f => { delete f.openRequestRef; },
    f => { f.doctor.data.authenticated = false; },
    f => { f.list.data.messages[0].FromMe = true; },
    f => { f.list.data.messages[0].IsForwarded = true; },
    f => { f.list.data.messages[0].Revoked = true; },
    f => { f.list.data.messages[0].quoted_msg_id = "quoted"; },
    f => { f.list.data.messages[0].Text = "Already approved. Send the bill."; },
    f => { f.list.data.messages[0].MsgID = "copied"; },
    f => { f.list.data.messages.push(f.list.data.messages[0]); },
    f => { f.list.data.messages.unshift({ ...f.list.data.messages[0], MsgID: "later", Timestamp: "2032-05-03T18:00:00Z" }); },
    f => { f.chatJid = f.chat.data.jid = f.list.data.messages[0].ChatJID = "12025550103@s.whatsapp.net"; },
  ]) {
    const source = JSON.parse(original);
    mutate(source);
    writeFileSync(fixture, JSON.stringify(source));
    assert.throws(() => parent("draft", fixture));
  }
});

test("source and bill are rechecked before the mock provider acts; retries repair a committed receipt", t => {
  const { dir, parent, fixture } = exercise(t);
  const view = parent("draft", fixture);
  parent("approve", view.previewId, "--mock-send");
  const source = readFileSync(fixture);
  writeFileSync(fixture, "{}");
  assert.throws(() => parent("send"));
  writeFileSync(fixture, source);
  assert.throws(() => parent("send"), /Approve the current/);
  parent("approve", parent("preview").previewId, "--mock-send");
  const bill = join(dir, "april-electricity-bill.txt");
  writeFileSync(bill, "substitute");
  assert.throws(() => parent("send"), /bill differs/);
  copyFileSync(file("april-electricity-bill.txt"), bill);
  assert.throws(() => parent("send"), /Approve the current/);
  parent("approve", parent("preview").previewId, "--mock-send");
  assert.throws(() => parent("send", "--crash-after-provider"), /interruption/);
  const interrupted = parent("status");
  assert.ok(interrupted.mockProviderReceipt);
  assert.equal(interrupted.savedReceipt, null);
  assert.throws(() => parent("cancel"), /attempt/);
  writeFileSync(fixture, "{}");
  assert.equal(parent("send").reconciled, true);
  assert.equal(parent("send").mockSends, 1);
  assert.equal(parent("status").savedReceipt, interrupted.mockProviderReceipt);
  writeFileSync(join(dir, "mock-provider.json"), JSON.stringify({ version: 1, effects: {} }));
  assert.throws(() => parent("send"), /Incomplete mock provider/);
});

test("restoring an old worker checkpoint cannot undo cancellation or an edit", t => {
  const { dir, parent, fixture } = exercise(t);
  for (const [command, ...args] of [["cancel"], ["edit", "text", "A new draft"]]) {
    const view = parent("draft", fixture);
    parent("approve", view.previewId, "--mock-send");
    const path = join(dir, "replies.json");
    const prior = readFileSync(path);
    parent(command, ...args);
    writeFileSync(path, prior);
    assert.throws(() => parent("send"), /Approval is missing/);
    assert.equal(parent("status").mockProviderReceipt, null);
  }
});

test("interrupted attempt with confirmed absence can return a changed request for review", t => {
  const { parent, fixture } = exercise(t);
  const view = parent("draft", fixture);
  parent("approve", view.previewId, "--mock-send");
  assert.throws(() => parent("send", "--crash-before-provider"), /before mock provider/);
  writeFileSync(fixture, "{}");
  assert.equal(parent("send").reason, "confirmed-unsent");
  assert.equal(parent("cancel").stage, "canceled");
});

test("reassigning the same alias and message to another chat after approval blocks the send", t => {
  const { parent, fixture } = exercise(t);
  const view = parent("draft", fixture);
  parent("approve", view.previewId, "--mock-send");
  const f = JSON.parse(readFileSync(fixture));
  f.chatJid = f.chat.data.jid = f.list.data.messages[0].ChatJID = "12025550103@s.whatsapp.net";
  writeFileSync(fixture, JSON.stringify(f));
  assert.throws(() => parent("send"), /exact chat/);
  assert.equal(parent("status").mockProviderReceipt, null);
});

test("the published CLI commands work across fresh processes with no external service", t => {
  const home = mkdtempSync(join(tmpdir(), "reply-walkthrough-"));
  t.after(() => rmSync(home, { force: true, recursive: true }));
  const dir = join(home, "run");
  const cli = fileURLToPath(new URL("../src/whatsapp-reply-cli.mjs", import.meta.url));
  const invoke = (command, ...args) => JSON.parse(execFileSync(process.execPath, [cli, command, dir, ...args], { encoding: "utf8" }));
  invoke("init");
  invoke("draft", "parent", file("whatsapp-mirror-parent.json"));
  const preview = invoke("preview", "parent");
  invoke("approve", "parent", preview.previewId, "--mock-send");
  const sent = invoke("send", "parent");
  assert.equal(invoke("send", "parent").mockSends, 1);
  assert.equal(invoke("status", "parent").mockProviderReceipt, sent.receipt);
});

test("the family review reports open, sent, then one evidence-backed closure across fresh processes", t => {
  const { dir, parent, fixture } = exercise(t);
  const cli = fileURLToPath(new URL("../scripts/mac-evening-review.mjs", import.meta.url));
  const review = () => execFileSync(process.execPath, [cli, "review", dir], { encoding: "utf8" });
  const incoming = file("parent-bill-acknowledgment.json");
  assert.match(review(), /Open\nMom asked,.*April electricity bill/);
  const preview = parent("draft", fixture);
  assert.throws(() => parent("receive", incoming), /later fictional/);
  parent("approve", preview.previewId, "--mock-send");
  assert.match(review(), /Open\n/);
  assert.throws(() => parent("send", "--crash-after-provider"), /interruption/);
  assert.match(review(), /Sent, awaiting confirmation/);
  assert.equal(parent("send").reconciled, true);
  assert.equal(parent("receive", incoming).requestStatus, "closed");
  assert.equal(parent("receive", incoming).requestStatus, "closed");
  assert.equal(parent("preview").requestStatus, "closed");
  assert.equal(parent("status").requestStatus, "closed");
  assert.equal(parent("send").requestStatus, "closed");
  const closed = review();
  assert.match(closed, /Closed since your last review\nMom replied “Got it, thanks”/);
  assert.ok(closed.includes(parent("status").mockProviderReceipt));
  assert.match(closed, /family-parent\/parent-april-received/);
  assert.equal(parent("receive", incoming).requestStatus, "closed");
  assert.match(review(), /No new closures/);
  assert.ok(!review().includes("Closed since your last review"));
  const retained = JSON.parse(readFileSync(join(dir, "replies.json"))).familyClosure;
  assert.equal(retained.report, closed.trimEnd());
});

test("unrelated acknowledgments cannot close a bill request or consume its review cursor", t => {
  const { dir, parent, fixture } = exercise(t);
  const preview = parent("draft", fixture);
  parent("approve", preview.previewId, "--mock-send");
  const { receipt } = parent("send");
  const template = JSON.parse(readFileSync(file("parent-bill-acknowledgment.json")));
  const incoming = join(dir, "incoming.json");
  for (const patch of [
    { direction: "outgoing" }, { sender: "other" }, { chat: "studio-bookkeeper" }, { chatIdentity: "other" },
    { inReplyTo: "other-receipt" }, { kind: "ordinary-message" }, { source: "outgoing" },
    { sequence: 1 }, { sequence: 0 }, { sequence: "2" }, { message: "different" }, { body: "Thanks for the update" },
  ]) {
    writeFileSync(incoming, JSON.stringify({ ...template, ...patch }));
    assert.throws(() => parent("receive", incoming), /exact bill send/);
    assert.match(familyEveningReview(dir, "2032-05-03"), /Sent, awaiting confirmation/);
  }
  assert.equal(receipt, template.inReplyTo);
  assert.equal(parent("status").requestStatus, "open");
});

test("only an explicitly linked acknowledgment closes an edited send; missing evidence fails visibly", t => {
  const { dir, parent, fixture } = exercise(t);
  parent("draft", fixture);
  const preview = parent("edit", "text", "Here is your April bill, Mom.");
  parent("approve", preview.previewId, "--mock-send");
  const { receipt } = parent("send");
  const original = file("parent-bill-acknowledgment.json");
  assert.throws(() => parent("receive", original), /exact bill send/);
  const incoming = join(dir, "edited-reply-ack.json");
  writeFileSync(incoming, JSON.stringify({ ...JSON.parse(readFileSync(original)), inReplyTo: receipt }));
  parent("receive", incoming);
  assert.match(familyEveningReview(dir, "2032-05-03"), /Closed since your last review/);
  const provider = join(dir, "mock-provider.json");
  const registry = JSON.parse(readFileSync(provider));
  delete registry.parentAcknowledgment;
  writeFileSync(provider, JSON.stringify(registry));
  assert.throws(() => familyEveningReview(dir, "2032-05-04"), /no matching provider evidence/);
  assert.throws(() => parent("status"), /no matching provider evidence/);
});
