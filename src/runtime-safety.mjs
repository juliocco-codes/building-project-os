import { reconcilePublication } from "./project-os.mjs";

const finite = (...values) => values.every(value => typeof value === "number" && Number.isFinite(value));

// Numeric times share one caller-defined clock. This model performs no I/O.
export function workHealth(record, { now, maxPulseAge, maxCompletionAge }) {
  if (!finite(now, maxPulseAge, maxCompletionAge) || maxPulseAge <= 0 || maxCompletionAge <= 0) throw new Error("Invalid health policy.");
  if (record?.status === "failed") return { healthy: false, reason: "reported_failure" };
  if (record?.status === "completed") {
    if (!finite(record.completedAt) || record.completedAt > now) return { healthy: false, reason: "invalid_record" };
    return { healthy: now - record.completedAt <= maxCompletionAge, reason: now - record.completedAt <= maxCompletionAge ? "cycle_completed" : "completion_stale" };
  }
  if (record?.status !== "running" || !finite(record.startedAt, record.pulseAt, record.deadline) || record.startedAt > record.pulseAt || record.pulseAt > now || record.deadline <= record.startedAt) return { healthy: false, reason: "invalid_record" };
  if (now >= record.deadline) return { healthy: false, reason: "operation_overdue" };
  if (now - record.pulseAt > maxPulseAge) return { healthy: false, reason: "pulse_stale" };
  return { healthy: true, reason: "bounded_work_running" };
}

export function pulseWork(record, now) {
  if (record?.status !== "running" || !finite(now, record.startedAt, record.pulseAt, record.deadline) || record.startedAt > record.pulseAt || now < record.pulseAt || now >= record.deadline) throw new Error("Cannot pulse invalid or expired work.");
  // Never recompute the deadline from a pulse. A new operation needs its own bound.
  return { ...record, pulseAt: now };
}

// Persist the returned state with a transaction/CAS against the current lease.
// Terminal health and release are one transition, never release-then-publish.
export function writeOwnedHealth(state, { claim, record, now, release = false }) {
  const lease = state?.lease;
  if (!lease || !claim || !finite(now, lease.expiresAt) || typeof lease.owner !== "string" || !lease.owner || !Number.isSafeInteger(lease.generation) || lease.generation < 1 || lease.owner !== claim.owner || lease.generation !== claim.generation || now >= lease.expiresAt) return { accepted: false, state, reason: "not_current_owner" };
  if (!["running", "completed", "failed"].includes(record?.status) || (release && record.status === "running")) throw new Error("Invalid terminal health transition.");
  return { accepted: true, state: { ...state, health: { ...record, owner: claim.owner, generation: claim.generation }, lease: release ? null : lease } };
}

// This is a checkpoint proposal, not permission to send before durable storage.
// Every retry uses fresh evidence bound to the preceding attempt.
export function checkpointPublicationAttempt(receipt, evidence, options) {
  if (!["prepared", "attempting", "deferred", "ambiguous", "confirmed"].includes(receipt?.state)) throw new Error("Invalid publication state.");
  const attempt = receipt?.attempt ?? 0;
  if (!Number.isSafeInteger(attempt) || attempt < 0 || attempt >= Number.MAX_SAFE_INTEGER) throw new Error("Invalid publication attempt.");
  if (attempt > 0 && evidence?.attempt !== attempt) return { action: "stop", reason: "attempt_evidence_mismatch" };
  const decision = reconcilePublication(receipt, evidence, options);
  if (receipt.state === "confirmed" && decision.action !== "none") return { action: "stop", reason: "confirmed_receipt_conflict" };
  if (decision.action !== "publish") return decision;
  return { action: "checkpoint_before_send", receipt: { ...receipt, state: "attempting", attempt: attempt + 1 } };
}

// The adapter must verify outcomes against the original request, not infer them
// from tool duration, missing messages, or an arbitrary error string.
export function settlePublicationAttempt(receipt, evidence) {
  if (receipt?.state !== "attempting" || !Number.isSafeInteger(receipt.attempt) || receipt.attempt < 1) throw new Error("No publication attempt is in flight.");
  const bound = evidence?.key === receipt.key && evidence?.attempt === receipt.attempt;
  const state = !bound ? "ambiguous" : evidence.outcome === "confirmed" ? "confirmed" : evidence.outcome === "not_started" ? "deferred" : "ambiguous";
  return { ...receipt, state };
}
