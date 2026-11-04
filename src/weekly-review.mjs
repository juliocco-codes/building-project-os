import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmdirSync,
  openSync, closeSync, fsyncSync } from "node:fs";
import { join } from "node:path";

// All identities and inputs in this module are fictional. No network or model calls.
const TASK = "fictional-field-guide-weekly-review";
const DESTINATION = "mock-editor-inbox";
const MAX_AGE = 24 * 60 * 60 * 1000;
const CONTRACT = { task: TASK, version: 1, allowed: ["read-fixtures", "draft"],
  reviewRequired: ["choose-map", "mock-delivery"], destination: DESTINATION };
export const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const CONTRACT_HASH = digest(CONTRACT);
const fail = message => { throw new Error(message); };
const read = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));

// Atomic replacement on a local filesystem; this is not a distributed transaction.
function write(dir, name, value) {
  const target = join(dir, `${name}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fsyncSync(fd); }
  finally { closeSync(fd); }
  renameSync(temporary, target);
  const directory = openSync(dir, "r");
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

function locked(dir, action) {
  const lock = join(dir, ".lock");
  try { mkdirSync(lock); }
  catch (error) {
    if (error.code === "EEXIST") fail("Workspace locked. Verify the owner has exited before removing .lock; see the recovery guide.");
    throw error;
  }
  try { return action(); } finally { rmdirSync(lock); }
}

function sources(dir) {
  const input = read(dir, "sources");
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).sort().join() !== "calendar,notes,research") fail("Invalid source schema");
  const text = value => typeof value === "string" && value.length <= 4000;
  for (const [name, keys] of [["notes", "text"], ["calendar", "available,events"], ["research", "available,connectivity,text"]]) {
    if (!input[name] || Object.keys(input[name]).sort().join() !== keys) fail(`Invalid ${name} schema`);
  }
  if (!text(input.notes.text) || typeof input.calendar.available !== "boolean"
    || !Array.isArray(input.calendar.events) || input.calendar.events.length > 30
    || !input.calendar.events.every(text) || typeof input.research.available !== "boolean"
    || !["unknown", "online", "offline"].includes(input.research.connectivity)
    || !text(input.research.text)) fail("Invalid source data");
  return input;
}

function artifactFor(input, coverage) {
  return { task: TASK, contractHash: CONTRACT_HASH,
    coverage,
    glossary: "Place the glossary beside the map.",
    map: input.research.available && input.research.connectivity === "offline" ? "printable" : "linked",
    provisional: !input.research.available || input.research.connectivity === "unknown",
    calendar: input.calendar.available ? { checked: true, deadlines: input.calendar.events }
      : { checked: false, limitation: "Calendar unavailable; deadlines are unknown." },
    evidence: { notes: input.notes.text, research: input.research.available ? input.research.text : null },
    nextActor: "human",
    nextAction: "Review the source coverage and map recommendation; approve this exact artifact and mock delivery or revise the sources." };
}

function load(dir) {
  const state = read(dir, "checkpoint");
  if (state.version !== 1 || state.task !== TASK || state.contractHash !== CONTRACT_HASH
    || !Array.isArray(state.history) || !state.coverage || typeof state.coverage !== "object") fail("Invalid checkpoint");
  if (state.artifact && digest(state.artifact) !== state.artifactHash) fail("Artifact hash mismatch");
  return state;
}

function current(state, input, now) {
  if (!state.artifact) fail("Run review first");
  for (const name of ["notes", "calendar", "research"]) {
    const check = state.coverage[name];
    if (!check || check.sourceHash !== digest(input[name]) || !Number.isFinite(check.checkedAt)
      || check.checkedAt > now || now - check.checkedAt >= MAX_AGE) fail("Sources changed or expired; run review and obtain fresh approval");
  }
  if (digest(artifactFor(input, state.coverage)) !== state.artifactHash) fail("Checkpoint does not match source evidence");
}

function expectedReceipt(state, grant) {
  const binding = { task: TASK, contractHash: CONTRACT_HASH, artifactHash: state.artifactHash,
    grantId: grant.id, decision: grant.decision, destination: DESTINATION };
  const key = digest(binding);
  return { ...binding, key, receiptId: `mock-${key}`, status: "delivered" };
}

function acceptedGrant(dir, state) {
  const authority = read(dir, "authority");
  if (authority.version !== 1 || !Array.isArray(authority.grants)) fail("Invalid authority registry");
  const grant = authority.grants.find(item => item.id === state.grantId);
  if (!grant || grant.artifactHash !== state.artifactHash || grant.contractHash !== CONTRACT_HASH
    || grant.task !== TASK || grant.destination !== DESTINATION || grant.action !== "mock-delivery"
    || grant.decision !== state.artifact.map) fail("No accepted grant for this exact artifact, decision, and destination");
  return grant;
}

function provider(dir) {
  const registry = read(dir, "provider");
  if (registry.version !== 1 || !Array.isArray(registry.effects)) fail("Invalid provider registry");
  return registry;
}

function reconcile(state, registry, grant) {
  const expected = expectedReceipt(state, grant);
  const matches = registry.effects.filter(effect => effect.receipt?.key === expected.key);
  if (matches.length > 1) fail("Duplicate provider entries; reconciliation required");
  const effect = matches[0];
  if (effect && (JSON.stringify(effect.receipt) !== JSON.stringify(expected)
    || digest(effect.artifact) !== state.artifactHash)) fail("Provider evidence does not match the exact operation");
  if (state.receipt && (!effect || JSON.stringify(state.receipt) !== JSON.stringify(effect.receipt))) {
    fail("Untrusted or mismatched checkpoint receipt");
  }
  return { expected, effect };
}

export function runWeeklyReview(command, dir, args = [], { now = Date.now(), crashAfterProvider = false } = {}) {
  if (!Number.isFinite(now)) fail("Invalid time");
  if (command === "init") {
    if (args.length) fail("init accepts no additional arguments");
    // Refuse to overwrite a previous run, including a partially initialized one.
    mkdirSync(dir, { mode: 0o700 });
    write(dir, "sources", { notes: { text: "The fictional field guide needs a glossary and a map. Internet access is unverified." },
      calendar: { available: true, events: [] }, research: { available: false, connectivity: "unknown", text: "" } });
    write(dir, "authority", { version: 1, grants: [] });
    write(dir, "provider", { version: 1, effects: [] });
    write(dir, "checkpoint", { version: 1, task: TASK, contractHash: CONTRACT_HASH,
      stage: "initialized", coverage: {}, history: [] });
    return { stage: "initialized", next: "Run review. This workspace contains fictional local data only." };
  }
  if (!["review", "late", "approve", "deliver", "status"].includes(command)) fail("Unknown weekly-review command");
  if (command !== "approve" && args.length) fail(`${command} accepts no additional arguments`);
  return locked(dir, () => {
    const state = load(dir);
    const input = sources(dir);
    if (command === "late") {
      input.research = { available: true, connectivity: "offline", text: "The fictional trail test found no mobile signal. Readers could not open the linked map." };
      write(dir, "sources", input);
      return { stage: "source-arrived", next: "Run review; existing approval cannot authorize changed evidence." };
    }
    if (command === "review") {
      // Do not discard an unresolved attempt when new evidence arrives.
      if (state.stage === "attempting") fail("Reconcile the pending delivery with deliver before starting another review");
      if (state.receipt) reconcile(state, provider(dir), acceptedGrant(dir, state));
      const reused = [];
      for (const name of ["notes", "calendar", "research"]) {
        const old = state.coverage[name];
        const sourceHash = digest(input[name]);
        if (old?.sourceHash === sourceHash && old.checkedAt <= now && now - old.checkedAt < MAX_AGE) reused.push(name);
        else state.coverage[name] = { sourceHash, checkedAt: now, status:
          name === "notes" || input[name].available ? "checked" : "unavailable" };
      }
      const artifact = artifactFor(input, state.coverage);
      const artifactHash = digest(artifact);
      if (artifactHash !== state.artifactHash) {
        if (state.artifactHash) state.history.push({ artifactHash: state.artifactHash, stage: state.stage, receipt: state.receipt ?? null });
        Object.assign(state, { artifact, artifactHash, stage: "awaiting-approval", grantId: null, receipt: null });
        write(dir, "checkpoint", state);
      }
      return { ...state, reused };
    }
    if (command === "status") {
      const registry = provider(dir);
      if (state.grantId || state.receipt) reconcile(state, registry, acceptedGrant(dir, state));
      return { ...state, mockDeliveries: registry.effects.length };
    }
    if (command === "approve") {
      current(state, input, now);
      const [artifactHash, decision, deliveryConsent] = args;
      if (args.length !== 3 || artifactHash !== state.artifactHash || decision !== state.artifact.map
        || deliveryConsent !== "--mock-delivery") fail("Approval requires the current artifact hash, recommended map choice, and --mock-delivery");
      if (state.stage === "attempting") fail("Reconcile pending delivery before approving again");
      const authority = read(dir, "authority");
      if (authority.version !== 1 || !Array.isArray(authority.grants)) fail("Invalid authority registry");
      let grant = authority.grants.find(item => item.artifactHash === artifactHash);
      if (!grant) {
        grant = { id: randomUUID(), task: TASK, contractHash: CONTRACT_HASH, artifactHash,
          decision, action: "mock-delivery", destination: DESTINATION, acceptedAt: now };
        authority.grants.push(grant);
        // The separate mock authority commits acceptance before the worker references it.
        write(dir, "authority", authority);
      }
      state.grantId = grant.id;
      acceptedGrant(dir, state);
      if (state.stage !== "delivered") state.stage = "approved";
      write(dir, "checkpoint", state);
      return { stage: state.stage, grantId: grant.id, artifactHash };
    }
    const grant = acceptedGrant(dir, state);
    const registry = provider(dir);
    const { expected, effect } = reconcile(state, registry, grant);
    // Confirmed delivery can be reconciled even after source changes or expiry.
    if (!effect) {
      current(state, input, now);
      if (state.stage === "delivered") fail("Provider evidence missing for completed delivery");
      state.stage = "attempting";
      write(dir, "checkpoint", state);
      registry.effects.push({ receipt: expected, artifact: state.artifact });
      write(dir, "provider", registry);
      if (crashAfterProvider) fail("Simulated crash after provider commit; rerun deliver to reconcile");
    }
    state.receipt = expected;
    state.stage = "delivered";
    write(dir, "checkpoint", state);
    return { stage: state.stage, receipt: expected, reconciled: Boolean(effect), mockDeliveries: registry.effects.length };
  });
}
