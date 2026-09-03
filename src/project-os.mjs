import { createHash } from "node:crypto";

const states = new Set(["ready", "planned", "in_progress", "in_review", "completed", "blocked"]);
const actors = new Set(["agent", "human"]);
const automationLevels = new Set(["full", "partial", "none"]);
const highImpactActions = new Set(["send", "purchase", "book", "delete", "publish", "change_permissions"]);

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
