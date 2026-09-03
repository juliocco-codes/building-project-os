import test from "node:test";
import assert from "node:assert/strict";
import {
  beginWork,
  claimKey,
  confirmInitialHandoff,
  contractFingerprint,
  createReviewHandoff,
  dispatchDecision,
  dispatchRecordKey,
  effectiveContractText,
  shouldSendDispatch,
  validateTask,
} from "../src/project-os.mjs";

const task = {
  id: "TASK-12",
  revision: 3,
  outcome: "Compare three suitable options and return a recommendation.",
  state: "ready",
  nextActor: "agent",
  automationLevel: "partial",
  inScope: ["Research current options", "Compare them against the agreed criteria"],
  outOfScope: ["Make a booking", "Contact a provider"],
  authority: { allowed: ["read", "research", "draft"], requiresReview: ["book", "send"] },
  success: "A sourced comparison and recommendation are attached to the task.",
  initialHandoff: { taskId: "TASK-12", revision: 3, state: "accepted" },
};

test("a valid ready task can be dispatched once", () => {
  assert.deepEqual(validateTask(task), []);
  assert.equal(dispatchDecision(task).eligible, true);
  assert.equal(dispatchDecision(task, new Set([claimKey(task)])).reason, "already_processed");
});

test("human work is not dispatched", () => {
  const decision = dispatchDecision({ ...task, nextActor: "human" });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, "waiting_for_human");
});

test("high-impact actions require review", () => {
  const unsafe = { ...task, authority: { allowed: ["read", "purchase"], requiresReview: [] } };
  assert.match(validateTask(unsafe).join("\n"), /purchase/);
});

test("work returns an explicit human handoff", () => {
  const inProgress = beginWork(task);
  const result = createReviewHandoff(inProgress, {
    summary: "Compared three options and identified the strongest fit.",
    evidence: ["Current provider pages", "Published terms"],
    notDone: ["No booking or contact was made."],
    decisionNeeded: "Choose whether to proceed with option A.",
  });
  assert.equal(result.task.state, "in_review");
  assert.equal(result.task.nextActor, "human");
});

test("contract fingerprints ignore line endings and trailing whitespace", () => {
  const unix = contractFingerprint("Outcome\nScope", ["Add criterion A"]);
  const windows = contractFingerprint("\nOutcome  \r\nScope\t\r\n", ["Add criterion A\r\n"]);
  assert.equal(unix, windows);
  assert.equal(effectiveContractText("A", ["B"]), "A\n\n--- accepted-amendment ---\n\nB");
});

test("ready work does not advance until its handoff is accepted", () => {
  const pending = { ...task.initialHandoff, state: "pending" };
  assert.equal(confirmInitialHandoff(task, pending).reason, "handoff_pending");
  assert.throws(() => beginWork(task, pending), /handoff_pending/);

  assert.equal(beginWork(task, task.initialHandoff).state, "in_progress");
});

test("dispatch records retry pending and failed work but never sent work", () => {
  assert.equal(shouldSendDispatch(undefined), true);
  assert.equal(shouldSendDispatch({ state: "pending" }), true);
  assert.equal(shouldSendDispatch({ state: "failed" }), true);
  assert.equal(shouldSendDispatch({ state: "sent" }), false);
  assert.equal(
    dispatchRecordKey({ taskId: task.id, revision: task.revision, kind: "review", cycle: 2, fingerprint: "sha256:abc" }),
    "review:TASK-12@3:2:sha256:abc",
  );
});
