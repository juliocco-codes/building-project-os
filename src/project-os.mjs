import { createHash } from "node:crypto";

const states = new Set(["ready", "planned", "in_progress", "in_review", "completed", "blocked"]);
const actors = new Set(["agent", "human"]);
const automationLevels = new Set(["full", "partial", "none"]);
const highImpactActions = new Set(["send", "purchase", "book", "delete", "publish", "change_permissions"]);
const publicationEvidenceStates = new Set(["absent", "present", "indeterminate"]);

function requireFields(value, fields, label) {
  for (const field of fields) {
    if (value?.[field] === undefined || value[field] === null || value[field] === "") {
      throw new Error(`${label} requires ${field}.`);
    }
  }
}

export function stableReceiptKey(kind, fields) {
  const entries = Object.entries(fields).sort(([left], [right]) => left.localeCompare(right));
  requireFields(Object.fromEntries(entries), entries.map(([name]) => name), `${kind} receipt`);
  const body = JSON.stringify(Object.fromEntries(entries));
  return `${kind}:sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}

export function validateTask(task) {
  const errors = [];
  if (!task || typeof task !== "object") return ["Task must be an object."];
  if (!task.id?.trim()) errors.push("A stable task id is required.");
  if (!Number.isInteger(task.revision) || task.revision < 1) errors.push("Revision must be a positive integer.");
  if (!task.outcome?.trim()) errors.push("Outcome is required.");
  if (!states.has(task.state)) errors.push("State is invalid.");
  if (!actors.has(task.nextActor)) errors.push("Next actor is invalid.");
  if (!automationLevels.has(task.automationLevel)) errors.push("Automation level is invalid.");
  if (!Array.isArray(task.inScope) || task.inScope.length === 0) errors.push("At least one in-scope item is required.");
  if (!Array.isArray(task.outOfScope)) errors.push("Out-of-scope actions must be an array.");
  if (!Array.isArray(task.authority?.allowed)) errors.push("Allowed actions must be an array.");
  if (!Array.isArray(task.authority?.requiresReview)) errors.push("Review-required actions must be an array.");
  if (!task.success?.trim()) errors.push("A definition of success is required.");

  const allowed = new Set(task.authority?.allowed ?? []);
  const reviewed = new Set(task.authority?.requiresReview ?? []);
  for (const action of highImpactActions) {
    if (allowed.has(action) && !reviewed.has(action)) {
      errors.push(`High-impact action '${action}' must also require review.`);
    }
  }
  if (task.automationLevel === "none" && task.nextActor === "agent") {
    errors.push("A non-automatable task cannot name the agent as next actor.");
  }
  return errors;
}

export function claimKey(task) {
  return `${task.id}@${task.revision}`;
}

export function normalizeContractText(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

export function effectiveContractText(baseline, amendments = []) {
  return [baseline, ...amendments]
    .map(normalizeContractText)
    .filter(Boolean)
    .join("\n\n--- accepted-amendment ---\n\n");
}

export function contractFingerprint(baseline, amendments = []) {
  return `sha256:${createHash("sha256").update(effectiveContractText(baseline, amendments), "utf8").digest("hex")}`;
}

export function dispatchRecordKey({ taskId, revision, kind = "initial", cycle = 1, fingerprint }) {
  if (!taskId || !fingerprint) throw new Error("Dispatch records require a task id and contract fingerprint.");
  return `${kind}:${taskId}@${revision}:${cycle}:${fingerprint}`;
}

export function shouldSendDispatch(record) {
  return !record || record.state === "pending" || record.state === "failed";
}

export function confirmInitialHandoff(task, record) {
  if (!record) return { confirmed: false, reason: "missing_handoff" };
  if (record.taskId !== task.id || record.revision !== task.revision) {
    return { confirmed: false, reason: "wrong_task" };
  }
  if (record.state !== "accepted") return { confirmed: false, reason: `handoff_${record.state}` };
  return { confirmed: true, reason: "accepted" };
}

export function dispatchDecision(task, completedClaims = new Set(), initialHandoff = task?.initialHandoff) {
  const errors = validateTask(task);
  if (errors.length) return { eligible: false, reason: "invalid", errors };
  if (completedClaims.has(claimKey(task))) return { eligible: false, reason: "already_processed" };
  if (task.state !== "ready") return { eligible: false, reason: "not_ready" };
  if (task.nextActor !== "agent") return { eligible: false, reason: "waiting_for_human" };
  const handoff = confirmInitialHandoff(task, initialHandoff);
  if (!handoff.confirmed) return { eligible: false, reason: handoff.reason };
  return { eligible: true, reason: "dispatch", claim: claimKey(task) };
}

export function beginWork(task, initialHandoff) {
  const decision = dispatchDecision(task, new Set(), initialHandoff);
  if (!decision.eligible) throw new Error(`Task cannot begin: ${decision.reason}`);
  return { ...task, state: "in_progress" };
}

export function createReviewHandoff(task, { summary, evidence = [], notDone = [], decisionNeeded }) {
  if (task.state !== "in_progress") throw new Error("Only work in progress can enter review.");
  if (!summary?.trim() || !decisionNeeded?.trim()) throw new Error("Review requires a summary and decision.");
  return {
    task: { ...task, state: "in_review", nextActor: "human" },
    handoff: { summary, evidence, notDone, decisionNeeded },
  };
}

export function canonicalTaskIdentity({ taskId, trackerTitle }) {
  requireFields({ taskId, trackerTitle }, ["taskId", "trackerTitle"], "Canonical task identity");
  return { id: `issue:${taskId}`, title: trackerTitle, visibility: "user", persistent: true };
}

export function runtimeSessions({ taskId, trackerTitle, cycle = 1 }) {
  const publication = canonicalTaskIdentity({ taskId, trackerTitle });
  return {
    publication,
    worker: { id: `worker:${taskId}`, visibility: "private", cycle },
    reviewer: { id: `reviewer:${taskId}`, visibility: "private", cycle },
  };
}

export function attentionDecision({ event, healthy = true, alreadySurfaced = false }) {
  if (alreadySurfaced) return { surface: false, reason: "deduplicated" };
  if (event === "human_blocker" || event === "review_requested") return { surface: true, reason: event };
  if (event === "delivery_failed") return { surface: true, reason: event };
  return { surface: false, reason: healthy ? "quiet_progress" : "non_actionable" };
}

export function publicationReceiptKey({ taskId, fingerprint, lifecycle, cycle, submittedHead = "none", turnId }) {
  return stableReceiptKey("publication", { taskId, fingerprint, lifecycle, cycle, submittedHead, turnId });
}

export function beginPublication(input) {
  requireFields(input, ["turnId"], "Publication checkpoint");
  const key = publicationReceiptKey(input);
  return {
    key,
    state: "prepared",
    canonicalTaskId: canonicalTaskIdentity(input).id,
    turnId: input.turnId,
    lifecycle: input.lifecycle,
  };
}

export function reconcilePublication(receipt, evidence, { writerBusy = false } = {}) {
  requireFields(receipt, ["key", "state", "canonicalTaskId", "turnId"], "Publication receipt");
  if (!publicationEvidenceStates.has(evidence?.state)) throw new Error("Publication evidence state is invalid.");
  if (evidence.state === "indeterminate") return { action: "stop", state: "ambiguous", reason: "indeterminate_publication" };
  if (evidence.canonicalTaskId !== receipt.canonicalTaskId || evidence.turnId !== receipt.turnId) {
    return { action: "stop", state: "ambiguous", reason: "evidence_mismatch" };
  }
  if (evidence.state === "present") {
    return { action: "none", state: "confirmed", reason: "exact_evidence" };
  }
  if (writerBusy) return { action: "defer", state: "prepared", reason: "active_writer" };
  return { action: "publish", state: "prepared", reason: "confirmed_absent" };
}

// Callers derive these facts from a user action or a verified owner request,
// never from tool duration, missing views, or recovery heuristics.
export function recoveryAttentionDecision({ userRequestedOpen = false, verifiedApproval = false } = {}) {
  return { navigate: userRequestedOpen === true, notify: verifiedApproval === true };
}

export function deliveryReceiptKey({ taskId, fingerprint, lifecycle, cycle, submittedHead = "none", reviewResult = "not_applicable", channel }) {
  return stableReceiptKey("delivery", { taskId, fingerprint, lifecycle, cycle, submittedHead, reviewResult, channel });
}

export function deliveryDecision({ receipt, canonicalTaskExists, evidence = "absent" }) {
  if (evidence === "indeterminate") return { deliver: false, surface: true, reason: "indeterminate_delivery" };
  if (receipt?.state === "delivered" || evidence === "present") {
    return { deliver: false, surface: false, reason: "already_delivered", canonicalTaskExists };
  }
  return { deliver: true, surface: false, reason: "delivery_due", canonicalTaskExists };
}

export function acquireLease(current, { owner, now, ttl }) {
  requireFields({ owner, now, ttl }, ["owner", "now", "ttl"], "Lease");
  if (ttl <= 0) throw new Error("Lease ttl must be positive.");
  if (current && current.expiresAt > now && current.owner !== owner) return { acquired: false, lease: current };
  const generation = (current?.generation ?? 0) + 1;
  return { acquired: true, lease: { owner, generation, expiresAt: now + ttl } };
}

export function releaseLease(current, { owner, generation }) {
  if (!current || current.owner !== owner || current.generation !== generation) {
    return { released: false, lease: current, reason: "not_owner" };
  }
  return { released: true, lease: null, reason: "released" };
}

export function reconcileQueue(items, reconcileOne) {
  return items.map((item) => {
    try {
      return { taskId: item.id, ok: true, result: reconcileOne(item) };
    } catch (error) {
      return { taskId: item.id, ok: false, error: error.message };
    }
  });
}

export function executionWindowDecision({ startedAt, now, deadline, attempts, maxAttempts }) {
  requireFields({ startedAt, now, deadline, attempts, maxAttempts }, ["startedAt", "now", "deadline", "attempts", "maxAttempts"], "Execution window");
  if (deadline < startedAt || maxAttempts < 1) throw new Error("Execution window bounds are invalid.");
  if (now >= deadline) return { proceed: false, reason: "deadline_reached" };
  if (attempts >= maxAttempts) return { proceed: false, reason: "attempt_limit_reached" };
  return { proceed: true, reason: "within_bounds" };
}

export function healthRecord({ component, observedAt, status, detail }) {
  requireFields({ component, observedAt, status }, ["component", "observedAt", "status"], "Health record");
  return {
    key: stableReceiptKey("health-observation", { component, observedAt, status }),
    component,
    observedAt,
    status,
    detail: detail ?? null,
  };
}

export function supervisorDecision({ healthy, previousEscalationKey, observedFailure }) {
  if (healthy) return { escalate: false, escalationKey: null, rearmed: true };
  const escalationKey = stableReceiptKey("health", { observedFailure });
  return { escalate: escalationKey !== previousEscalationKey, escalationKey, rearmed: false };
}

export function reviewReceipt({ taskId, fingerprint, cycle, submittedHead, worker, reviewer, result }) {
  requireFields({ taskId, fingerprint, cycle, submittedHead, worker, reviewer, result }, ["taskId", "fingerprint", "cycle", "submittedHead", "worker", "reviewer", "result"], "Review receipt");
  if (worker === reviewer) throw new Error("Independent review requires a different reviewer.");
  return {
    key: stableReceiptKey("review", { taskId, fingerprint, cycle, submittedHead, worker, reviewer, result }),
    taskId,
    fingerprint,
    cycle,
    submittedHead,
    worker,
    reviewer,
    independent: true,
    result,
  };
}

export function mergeEligibility({ task, fingerprint, cycle, submittedHead, currentHead, target, expectedTargetHead, currentTargetHead, review, checks, conflict = false, protectionRefused = false }) {
  if (task.automationLevel !== "full") return { eligible: false, reason: "automation_not_full" };
  if (!task.authority?.allowed?.includes("merge")) return { eligible: false, reason: "merge_authority_missing" };
  if (!review || review.result !== "approved" || review.independent !== true) return { eligible: false, reason: "approval_missing" };
  if (review.taskId !== task.id || review.fingerprint !== fingerprint || review.cycle !== cycle || review.submittedHead !== submittedHead) return { eligible: false, reason: "approval_mismatch" };
  if (currentHead !== submittedHead) return { eligible: false, reason: "submitted_head_changed" };
  if (currentTargetHead !== expectedTargetHead) return { eligible: false, reason: "target_drift" };
  if (!Array.isArray(checks) || checks.length === 0 || checks.some((check) => check.status !== "passed")) return { eligible: false, reason: "checks_not_green" };
  if (conflict) return { eligible: false, reason: "merge_conflict" };
  if (protectionRefused) return { eligible: false, reason: "protection_refused" };
  return {
    eligible: true,
    reason: "merge_authorized",
    key: stableReceiptKey("merge", { taskId: task.id, fingerprint, cycle, submittedHead, reviewResult: review.result, target, expectedTargetHead }),
    submittedHead,
    target,
  };
}

export function verifyMerge(receipt, { mergedHead, base }) {
  if (!receipt?.key) return { complete: false, reason: "merge_receipt_missing" };
  if (mergedHead !== receipt.submittedHead || base !== receipt.target) return { complete: false, reason: "merge_evidence_mismatch" };
  return { complete: true, reason: "verified" };
}
