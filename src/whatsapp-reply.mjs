import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { digest, locked, read, write } from "./local-json.mjs";
import { readMirrorFixture } from "./whatsapp-mirror.mjs";

const billName = "april-electricity-bill.txt";
const exampleBill = new URL("../examples/" + billName, import.meta.url);
const cases = {
  parent: {
    chat: "family-parent", jid: "12025550101@s.whatsapp.net", message: "parent-april-copy", display: "Mom",
    incoming: "Could you send me a copy of the April electricity bill?",
    voice: "Warm and brief. Calls this parent Mom.",
    example: "Here you go, Mom. See you Sunday!",
    reply: "Here you go, Mom! The April electricity bill is $48.00 and it's due May 10.",
  },
  bookkeeper: {
    chat: "studio-bookkeeper", jid: "12025550102@s.whatsapp.net", message: "bookkeeper-april-copy", display: "Studio bookkeeper",
    incoming: "Could you send me a copy of the April electricity bill for the studio books?",
    voice: "Lead with the document and include its filing reference.",
    example: "Attached is the studio supply receipt, reference SC-MAR. Thanks for filing it.",
    reply: "Attached is the April electricity bill from Paper Finch Energy for the studio books. Reference PF-APR, $48.00, due May 10.",
  },
};

function fail(message) { throw new Error(message); }

function evidenceAt(path, c) {
  const snapshot = readMirrorFixture(path);
  if (snapshot.mode !== "fictional" || snapshot.coverage !== "complete" || snapshot.chatRef !== c.chat || snapshot.chatJid !== c.jid) {
    fail("Select a complete fictional snapshot for the exact chat.");
  }
  const matches = snapshot.messages.filter(m => m.messageRef === c.message);
  const message = matches[0];
  if (snapshot.openRequestRef !== c.message || matches.length !== 1 || snapshot.messages.some(m => m !== message && Date.parse(m.timestamp) >= Date.parse(message.timestamp)) ||
      message.direction !== "incoming" || message.directText !== true || message.body !== c.incoming) {
    fail("The selected inbound request is missing, changed, indirect, ambiguous, or followed by a newer message. Review the conversation.");
  }
  return { chat: snapshot.chatRef, chatIdentity: snapshot.chatJid, message: message.messageRef, direction: message.direction,
    body: message.body, timestamp: message.timestamp };
}

function attachmentAt(dir) {
  const bytes = readFileSync(join(dir, billName));
  if (!bytes.equals(readFileSync(exampleBill))) fail("The local bill differs from the example. Restore the reviewed sample and preview again.");
  return { name: billName, sha256: createHash("sha256").update(bytes).digest("hex"), content: bytes.toString("utf8") };
}

function payloadFor(dir, c, draft) {
  const evidence = evidenceAt(draft.source, c);
  if (digest(evidence) !== draft.evidenceHash) fail("The selected evidence changed. Inspect it and draft again.");
  return { action: "simulate-whatsapp-reply", evidence, revision: draft.revision, recipient: draft.recipient,
    text: draft.text, attachment: draft.attach ? attachmentAt(dir) : null };
}

function view(dir, c, draft) {
  const payload = payloadFor(dir, c, draft);
  return { stage: draft.stage, requestStatus: "open", relationship: c.display,
    voiceCue: c.voice, previouslyApprovedExample: c.example, payload, previewId: digest(payload) };
}

function requireEditable(draft) {
  if (["attempting", "simulated"].includes(draft.stage)) fail("A send attempt already exists. Reconcile it with send.");
}

function revoke(dir, name) {
  const approvals = read(dir, "approvals");
  if (Object.hasOwn(approvals, name)) {
    delete approvals[name];
    write(dir, "approvals", approvals);
  }
}

function returnForReview(dir, state, name, draft) {
  revoke(dir, name);
  draft.revision++;
  draft.stage = "awaiting-approval";
  draft.approvedId = null;
  write(dir, "replies", state);
}

function validateGrant(grant, expectedId) {
  if (!grant || grant.id !== digest(grant.payload) || grant.id !== expectedId) {
    fail("Approval is missing or mismatched. Review and approve the current preview.");
  }
}

// Each case permits one outbound bill. Legacy mock effects occupy the same first outgoing slot.
function matchAcknowledgment(event, effect) {
  const expected = { source: "fictional-incoming", kind: "attachment-received", chat: cases.parent.chat,
    chatIdentity: cases.parent.jid, sender: cases.parent.jid, direction: "incoming",
    message: "parent-april-received", body: "Got it, thanks" };
  const sentAt = effect && Object.hasOwn(effect, "sequence") ? effect.sequence : 1;
  if (!effect || !Object.entries(expected).every(([key, value]) => event?.[key] === value) ||
      event.inReplyTo !== effect.receipt || !Number.isSafeInteger(sentAt) || sentAt < 1 ||
      !Number.isSafeInteger(event.sequence) || event.sequence <= sentAt) {
    fail("Acknowledgment must be the later fictional incoming reply from Mom to this exact bill send.");
  }
  return { ...expected, inReplyTo: event.inReplyTo, sequence: event.sequence };
}

function providerAt(dir) {
  const registry = read(dir, "mock-provider");
  if (registry?.version !== 1 || !registry.effects ||
      Object.keys(registry.effects).sort().join(",") !== "bookkeeper,parent") fail("Incomplete mock provider. Reconcile before retrying.");
  for (const [name, effect] of Object.entries(registry.effects)) {
    if (effect === null) continue;
    const c = cases[name];
    if (!effect?.payload || effect.payload.recipient !== c.chat ||
        effect.payload.evidence?.chat !== c.chat || effect.payload.evidence.chatIdentity !== c.jid || effect.payload.evidence?.message !== c.message ||
        effect.receipt !== "mock-" + digest(effect.payload)) fail("Mock provider evidence is mismatched. Reconcile before retrying.");
  }
  if (Object.hasOwn(registry, "parentAcknowledgment")) {
    registry.parentAcknowledgment = matchAcknowledgment(registry.parentAcknowledgment, registry.effects.parent);
  }
  return registry;
}

function familyEvidence(dir, state, registry) {
  const { parent: effect } = registry.effects;
  const acknowledgment = registry.parentAcknowledgment;
  const draft = state.drafts.parent;
  if (effect) {
    const grant = read(dir, "approvals").parent;
    validateGrant(grant, effect.receipt.slice("mock-".length));
    if (grant.payload.action !== "simulate-whatsapp-reply" || grant.payload.attachment?.name !== billName) {
      fail("The approved send must include the April bill.");
    }
  }
  if ((draft?.stage === "simulated" && !effect) || (draft?.receipt && draft.receipt !== effect?.receipt) ||
      (state.familyClosure && state.familyClosure.evidenceId !== digest(acknowledgment ?? null))) {
    fail("The previous receipt or closure has no matching provider evidence.");
  }
  return { effect, acknowledgment };
}

export function familyEveningReview(dir, day) {
  return locked(dir, () => {
    const state = read(dir, "replies");
    const { effect, acknowledgment } = familyEvidence(dir, state, providerAt(dir));
    const heading = "Evening review | " + day + " | Fictional family bill\n\n";
    if (!effect) {
      const path = state.drafts.parent?.source ?? new URL("../examples/whatsapp-mirror-parent.json", import.meta.url);
      const request = evidenceAt(path, cases.parent);
      return heading + "Open\nMom asked, “" + request.body + "”";
    }
    if (!acknowledgment) {
      return heading + "Sent, awaiting confirmation\nThe approved reply and " + billName + " were sent in the simulator. Mom has yet to confirm receipt.";
    }
    if (state.familyClosure) return heading + "No new closures. No open family bill request.";
    const report = heading + "Closed since your last review\nMom replied “" + acknowledgment.body +
      "” to the April bill.\nEvidence: " + acknowledgment.chat + "/" + acknowledgment.message +
      " in reply to " + effect.receipt;
    // Preserve what was reported and its cursor together, including if output is interrupted.
    state.familyClosure = { evidenceId: digest(acknowledgment), report };
    write(dir, "replies", state);
    return report;
  });
}

function send(dir, state, name, c, draft, crash) {
  if (!["approved", "attempting", "simulated"].includes(draft.stage)) fail("Approve the current preview before a simulated send.");
  const grant = read(dir, "approvals")[name];
  const registry = providerAt(dir);
  const effect = registry.effects[name];
  if (name === "parent" && state.familyClosure) familyEvidence(dir, state, registry);
  if (draft.stage === "attempting" && !effect) {
    // Under the mock's exclusive lock, this intact slot establishes no effect.
    let current;
    try { current = digest(payloadFor(dir, c, draft)); } catch { current = null; }
    if (!grant || !current || current !== draft.approvedId) {
      returnForReview(dir, state, name, draft);
      return { stage: draft.stage, reason: "confirmed-unsent", requestStatus: "open",
        next: "Inspect the source and bill, then draft and approve again." };
    }
  }
  validateGrant(grant, draft.approvedId);
  if (grant.payload.recipient !== c.chat || grant.payload.evidence.chat !== c.chat || grant.payload.evidence.chatIdentity !== c.jid ||
      grant.payload.evidence.message !== c.message) fail("Approval belongs to another request or recipient.");
  const receipt = "mock-" + grant.id;
  if (effect && effect.receipt !== receipt) fail("A different mock operation already exists for this request.");
  if (draft.receipt && (!effect || draft.receipt !== receipt)) fail("Worker receipt has no matching mock provider evidence.");
  if (!effect) {
    if (draft.stage === "simulated") fail("Mock provider evidence is missing for the recorded send.");
    try {
      if (digest(payloadFor(dir, c, draft)) !== grant.id) fail("Draft, recipient, or attachment changed.");
    } catch (error) {
      returnForReview(dir, state, name, draft);
      fail(error.message + " Approval retired. Inspect the source and bill, then preview and approve again.");
    }
    draft.stage = "attempting";
    write(dir, "replies", state);
    if (crash === "--crash-before-provider") fail("Simulated interruption before mock provider commit. Repeat send to reconcile.");
    registry.effects[name] = { receipt, payload: grant.payload, sequence: 1 };
    write(dir, "mock-provider", registry);
    if (crash === "--crash-after-provider") fail("Simulated interruption after mock provider commit. Repeat send to reconcile.");
  }
  draft.receipt = receipt;
  draft.stage = "simulated";
  write(dir, "replies", state);
  return { stage: draft.stage, receipt, reconciled: Boolean(effect), requestStatus: name === "parent" && registry.parentAcknowledgment ? "closed" : "open",
    mockSends: Object.values(registry.effects).filter(Boolean).length };
}

export function replyCommand(command, dir, name, args = []) {
  if (!dir) fail("Choose a local state directory.");
  if (command === "init") {
    if (name || args.length) fail("init takes only the new state directory.");
    mkdirSync(dir, { mode: 0o700 });
    copyFileSync(exampleBill, join(dir, billName));
    write(dir, "replies", { version: 1, drafts: {} });
    write(dir, "approvals", {});
    write(dir, "mock-provider", { version: 1, effects: { parent: null, bookkeeper: null } });
    return { stage: "initialized", next: "Choose a case and its fictional mirror fixture with draft." };
  }
  if (!Object.hasOwn(cases, name)) fail("Select parent or bookkeeper explicitly. A display name cannot identify a chat.");
  const c = cases[name];
  return locked(dir, () => {
    const state = read(dir, "replies");
    if (state.version !== 1 || !state.drafts) fail("Invalid reply state.");
    let draft = state.drafts[name];
    if (command === "draft") {
      if (args.length !== 1) fail("draft requires the path to the selected fictional mirror fixture.");
      const source = realpathSync(args[0]);
      const evidenceHash = digest(evidenceAt(source, c));
      if (draft) requireEditable(draft);
      draft = { source, evidenceHash, recipient: c.chat, text: c.reply, attach: true,
        revision: (draft?.revision ?? 0) + 1, stage: "awaiting-approval" };
      const result = view(dir, c, draft);
      revoke(dir, name);
      state.drafts[name] = draft;
      write(dir, "replies", state);
      return result;
    }
    if (!draft) fail("Select the case and its source using draft first.");
    switch (command) {
      case "preview":
        if (args.length) fail("preview takes no additional arguments.");
        return { ...view(dir, c, draft), requestStatus: name === "parent" &&
          familyEvidence(dir, state, providerAt(dir)).acknowledgment ? "closed" : "open" };
      case "edit": {
        requireEditable(draft);
        const [field, value] = args;
        if (args.length !== 2 || !value?.trim()) fail("edit takes a field and a nonempty value.");
        if (field === "text") draft.text = value;
        else if (field === "recipient" && Object.values(cases).some(item => item.chat === value)) draft.recipient = value;
        else if (field === "attachment" && ["none", "bill"].includes(value)) draft.attach = value === "bill";
        else fail("Use text, recipient with an exact fixture chat ID, or attachment with bill or none.");
        draft.revision++;
        draft.approvedId = null;
        draft.stage = "awaiting-approval";
        const result = view(dir, c, draft);
        revoke(dir, name);
        write(dir, "replies", state);
        return result;
      }
      case "approve": {
        requireEditable(draft);
        const preview = view(dir, c, draft);
        if (!draft.attach) fail("This bill-copy request requires the reviewed attachment. Add the bill and preview again.");
        if (draft.stage === "canceled" || draft.recipient !== c.chat || args.length !== 2 ||
            args[0] !== preview.previewId || args[1] !== "--mock-send") fail("Approve only the current preview in its original chat with --mock-send.");
        const approvals = read(dir, "approvals");
        approvals[name] = { id: preview.previewId, payload: preview.payload };
        write(dir, "approvals", approvals);
        draft.approvedId = preview.previewId;
        draft.stage = "approved";
        write(dir, "replies", state);
        return { stage: draft.stage, approvedId: draft.approvedId };
      }
      case "cancel":
        requireEditable(draft);
        if (args.length) fail("cancel takes no additional arguments.");
        draft.revision++;
        draft.approvedId = null;
        draft.stage = "canceled";
        revoke(dir, name);
        write(dir, "replies", state);
        return { stage: draft.stage, requestStatus: "open" };
      case "send":
        if (args.length && !(args.length === 1 && ["--crash-before-provider", "--crash-after-provider"].includes(args[0]))) fail("Unknown simulated send option.");
        return send(dir, state, name, c, draft, args[0]);
      case "receive": {
        if (name !== "parent" || args.length !== 1) fail("receive takes the parent case and a fictional acknowledgment file.");
        const registry = providerAt(dir);
        const { effect, acknowledgment } = familyEvidence(dir, state, registry);
        const event = matchAcknowledgment(JSON.parse(readFileSync(args[0], "utf8")), effect);
        if (acknowledgment && digest(acknowledgment) !== digest(event)) fail("A different acknowledgment is already recorded.");
        if (!acknowledgment) {
          registry.parentAcknowledgment = event;
          write(dir, "mock-provider", registry);
        }
        return { requestStatus: "closed", incoming: event.body, inReplyTo: event.inReplyTo };
      }
      case "status": {
        if (args.length) fail("status takes no additional arguments.");
        const registry = providerAt(dir);
        const effect = registry.effects[name];
        if (draft.receipt && draft.receipt !== effect?.receipt) fail("Worker receipt differs from mock provider evidence.");
        const closed = name === "parent" && familyEvidence(dir, state, registry).acknowledgment;
        return { stage: draft.stage, requestStatus: closed ? "closed" : "open", mockProviderReceipt: effect?.receipt ?? null,
          savedReceipt: draft.receipt ?? null };
      }
      default: fail("Unknown reply command.");
    }
  });
}
