import test from "node:test";
import assert from "node:assert/strict";
import { auditCloseout, closeoutRecordKey, contractFingerprint, planPublicationCloseout, validateDisposition } from "../src/project-os.mjs";

const fingerprint = contractFingerprint("Compare three fictional hotel options.");
const agentTask = { id: "TRIP-07", revision: 2, state: "ready", nextActor: "agent" };
const accepted = { taskId: "TRIP-07", revision: 2, state: "accepted" };

test("exactly one known disposition with a concrete next action is required", () => {
  assert.match(validateDisposition(agentTask, { kind: "planned" })[0], /must be/);
  assert.deepEqual(validateDisposition(agentTask, { kind: "agent_starts_now", nextAction: "Research rates" }), []);
  assert.ok(validateDisposition(agentTask, { kind: "user_acts_next", nextAction: "Choose dates" }).length > 0);
  assert.ok(validateDisposition(agentTask, { kind: "deferred", nextAction: "Research rates", reason: "Waiting on dates" }).length > 0);
});

test("agent-owned work closes only with an accepted handoff", () => {
  const plan = planPublicationCloseout(agentTask, { disposition: { kind: "agent_starts_now", nextAction: "Research rates" }, fingerprint, initialHandoff: accepted });
  assert.equal(plan.classification, "dispatched");
  assert.equal(plan.operations[0].key, closeoutRecordKey(agentTask, fingerprint, "handoff_accepted"));
});

test("a missing handoff blocks the task before writing its keyed blocker", () => {
  const plan = planPublicationCloseout(agentTask, { disposition: { kind: "agent_starts_now", nextAction: "Research rates" }, fingerprint, initialHandoff: null });
  assert.equal(plan.classification, "blocked_handoff");
  assert.deepEqual(plan.operations.map((operation) => operation.type), ["set_state", "record"]);
  assert.equal(plan.operations[1].value.reason, "missing_handoff");
  const replay = planPublicationCloseout({ ...agentTask, state: "blocked" }, { disposition: { kind: "agent_starts_now", nextAction: "Research rates" }, fingerprint, initialHandoff: null });
  assert.deepEqual(replay.operations.map((operation) => operation.type), ["record"]);
  assert.equal(replay.operations[0].key, plan.operations[1].key);
});

test("user-owned and deferred work record their disposition without dispatch", () => {
  const userTask = { ...agentTask, nextActor: "human" };
  assert.equal(planPublicationCloseout(userTask, { disposition: { kind: "user_acts_next", nextAction: "Choose dates" }, fingerprint }).classification, "user_owned");
  const deferred = planPublicationCloseout(userTask, { disposition: { kind: "deferred", nextAction: "Research rates", reason: "Dates unknown", activationCondition: "Dates confirmed" }, fingerprint });
  assert.equal(deferred.classification, "deferred");
  assert.equal(deferred.operations[0].value.activationCondition, "Dates confirmed");
});

test("the audit reports approved work without a closeout record as inert", () => {
  assert.equal(auditCloseout(agentTask, { fingerprint }).classification, "inert");
  const recordKeys = new Set([closeoutRecordKey(agentTask, fingerprint, "handoff_accepted")]);
  assert.equal(auditCloseout(agentTask, { fingerprint, recordKeys }).classification, "closed");
  const amended = contractFingerprint("Compare three fictional hotel options.", ["Add a fourth option."]);
  assert.equal(auditCloseout(agentTask, { fingerprint: amended, recordKeys }).classification, "inert");
  assert.equal(auditCloseout({ ...agentTask, state: "completed" }, { fingerprint }).classification, "not_applicable");
});
