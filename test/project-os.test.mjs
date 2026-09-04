import test from "node:test";
import assert from "node:assert/strict";
import {
  acquireLease,
  attentionDecision,
  beginWork,
  beginPublication,
  canonicalTaskIdentity,
  claimKey,
  confirmInitialHandoff,
  contractFingerprint,
  createReviewHandoff,
  dispatchDecision,
  dispatchRecordKey,
  deliveryDecision,
  deliveryReceiptKey,
  effectiveContractText,
  executionWindowDecision,
  healthRecord,
  mergeEligibility,
  publicationReceiptKey,
  reconcilePublication,
  reconcileQueue,
  releaseLease,
  reviewReceipt,
  runtimeSessions,
  shouldSendDispatch,
  supervisorDecision,
  validateTask,
  verifyMerge,
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

const runtimeInput = {
  taskId: "EXAMPLE-42",
  trackerTitle: "Prepare a fictional launch checklist",
  fingerprint: "sha256:example",
  lifecycle: "review",
  cycle: 2,
  submittedHead: "abc123",
  turnId: "turn-7",
};

test("visibility policy keeps healthy scheduled work quiet", () => {
  assert.deepEqual(attentionDecision({ event: "scheduled_progress", healthy: true }), {
    surface: false,
    reason: "quiet_progress",
  });
  assert.equal(attentionDecision({ event: "review_requested" }).surface, true);
  assert.equal(attentionDecision({ event: "delivery_failed" }).surface, true);
  assert.equal(attentionDecision({ event: "review_requested", alreadySurfaced: true }).reason, "deduplicated");
});

test("canonical identity is stable and private sessions do not compete for visibility", () => {
  const first = runtimeSessions({ taskId: runtimeInput.taskId, trackerTitle: runtimeInput.trackerTitle, cycle: 1 });
  const correction = runtimeSessions({ taskId: runtimeInput.taskId, trackerTitle: runtimeInput.trackerTitle, cycle: 3 });
  assert.deepEqual(first.publication, correction.publication);
  assert.deepEqual(first.publication, canonicalTaskIdentity(runtimeInput));
  assert.equal(first.worker.visibility, "private");
  assert.equal(first.reviewer.visibility, "private");
});

test("lifecycle idempotency binds contract, cycle, head, and lifecycle", () => {
  const key = publicationReceiptKey(runtimeInput);
  assert.equal(key, publicationReceiptKey({ ...runtimeInput }));
  assert.notEqual(key, publicationReceiptKey({ ...runtimeInput, cycle: 3 }));
  assert.notEqual(key, publicationReceiptKey({ ...runtimeInput, submittedHead: "def456" }));
  assert.notEqual(key, publicationReceiptKey({ ...runtimeInput, turnId: "turn-8" }));
  assert.throws(() => publicationReceiptKey({ ...runtimeInput, turnId: undefined }), /turnId/);
});

test("crash recovery uses exact evidence and fails closed when ambiguous", () => {
  assert.throws(() => beginPublication({ ...runtimeInput, turnId: undefined }), /turnId/);
  const prepared = beginPublication(runtimeInput);
  assert.equal(prepared.state, "prepared");
  assert.equal(reconcilePublication(prepared, { state: "absent" }).action, "publish");
  assert.equal(reconcilePublication(prepared, {
    state: "present",
    canonicalTaskId: prepared.canonicalTaskId,
    turnId: prepared.turnId,
  }).state, "confirmed");
  assert.equal(reconcilePublication(prepared, { state: "indeterminate" }).action, "stop");
  assert.equal(reconcilePublication(prepared, {
    state: "present",
    canonicalTaskId: prepared.canonicalTaskId,
    turnId: "another-turn",
  }).reason, "evidence_mismatch");
});

test("lease ownership prevents an expired owner releasing its replacement", () => {
  const original = acquireLease(null, { owner: "worker-a", now: 10, ttl: 5 }).lease;
  const replacement = acquireLease(original, { owner: "worker-b", now: 16, ttl: 5 }).lease;
  assert.equal(replacement.generation, 2);
  assert.equal(releaseLease(replacement, { owner: "worker-a", generation: original.generation }).released, false);
  assert.equal(releaseLease(replacement, { owner: "worker-b", generation: replacement.generation }).released, true);
});

test("execution is bounded by deadline and attempt count", () => {
  const window = { startedAt: 10, deadline: 20, maxAttempts: 3 };
  assert.equal(executionWindowDecision({ ...window, now: 15, attempts: 1 }).proceed, true);
  assert.equal(executionWindowDecision({ ...window, now: 20, attempts: 1 }).reason, "deadline_reached");
  assert.equal(executionWindowDecision({ ...window, now: 15, attempts: 3 }).reason, "attempt_limit_reached");
});

test("supervisor deduplicates failures and silently rearms after recovery", () => {
  const observation = healthRecord({ component: "reconciler", observedAt: 100, status: "stale", detail: "No recent checkpoint" });
  assert.match(observation.key, /^health-observation:sha256:/);
  const first = supervisorDecision({ healthy: false, observedFailure: "reconciler_stale" });
  const repeated = supervisorDecision({ healthy: false, observedFailure: "reconciler_stale", previousEscalationKey: first.escalationKey });
  assert.equal(first.escalate, true);
  assert.equal(repeated.escalate, false);
  assert.deepEqual(supervisorDecision({ healthy: true }), { escalate: false, escalationKey: null, rearmed: true });
});

test("delivery is independent from canonical task visibility", () => {
  const key = deliveryReceiptKey({ ...runtimeInput, reviewResult: "approved", channel: "example-channel" });
  assert.match(key, /^delivery:sha256:/);
  assert.deepEqual(deliveryDecision({ canonicalTaskExists: true }), {
    deliver: true,
    surface: false,
    reason: "delivery_due",
    canonicalTaskExists: true,
  });
  assert.equal(deliveryDecision({ canonicalTaskExists: false, receipt: { state: "delivered" } }).canonicalTaskExists, false);
  assert.equal(deliveryDecision({ canonicalTaskExists: true, evidence: "indeterminate" }).surface, true);
});

test("one broken issue does not prevent queue reconciliation", () => {
  const results = reconcileQueue([{ id: "A" }, { id: "B" }], (item) => {
    if (item.id === "A") throw new Error("fictional failure");
    return "advanced";
  });
  assert.equal(results[0].ok, false);
  assert.equal(results[1].result, "advanced");
});

function mergeInput(overrides = {}) {
  const mergeTask = {
    ...task,
    id: "EXAMPLE-42",
    automationLevel: "full",
    authority: { allowed: ["read", "merge"], requiresReview: [] },
  };
  const review = reviewReceipt({
    taskId: mergeTask.id,
    fingerprint: "sha256:example",
    cycle: 1,
    submittedHead: "abc123",
    worker: "implementation-worker",
    reviewer: "independent-reviewer",
    result: "approved",
  });
  return {
    task: mergeTask,
    fingerprint: "sha256:example",
    cycle: 1,
    submittedHead: "abc123",
    currentHead: "abc123",
    target: "main",
    expectedTargetHead: "base123",
    currentTargetHead: "base123",
    review,
    checks: [{ name: "tests", status: "passed" }],
    ...overrides,
  };
}

test("exact-head independent review permits one guarded merge", () => {
  const decision = mergeEligibility(mergeInput());
  assert.equal(decision.eligible, true);
  assert.equal(decision.key, mergeEligibility(mergeInput()).key);
  assert.deepEqual(verifyMerge(decision, { mergedHead: "abc123", base: "main" }), { complete: true, reason: "verified" });
});

test("review approval must be independent", () => {
  assert.throws(() => reviewReceipt({
    taskId: "EXAMPLE-42",
    fingerprint: "sha256:example",
    cycle: 1,
    submittedHead: "abc123",
    worker: "same-session",
    reviewer: "same-session",
    result: "approved",
  }), /different reviewer/);
});

test("guarded merge eligibility refuses missing authority and unsafe evidence", () => {
  assert.equal(mergeEligibility(mergeInput({ task: task })).reason, "automation_not_full");
  assert.equal(mergeEligibility(mergeInput({ task: { ...mergeInput().task, authority: { allowed: ["read"], requiresReview: [] } } })).reason, "merge_authority_missing");
  assert.equal(mergeEligibility(mergeInput({ currentHead: "changed" })).reason, "submitted_head_changed");
  assert.equal(mergeEligibility(mergeInput({ currentTargetHead: "drifted" })).reason, "target_drift");
  assert.equal(mergeEligibility(mergeInput({ checks: [{ name: "tests", status: "pending" }] })).reason, "checks_not_green");
  assert.equal(mergeEligibility(mergeInput({ review: { ...mergeInput().review, submittedHead: "old" } })).reason, "approval_mismatch");
  assert.equal(mergeEligibility(mergeInput({ cycle: 2 })).reason, "approval_mismatch");
  assert.equal(mergeEligibility(mergeInput({ conflict: true })).reason, "merge_conflict");
  assert.equal(mergeEligibility(mergeInput({ protectionRefused: true })).reason, "protection_refused");
});
