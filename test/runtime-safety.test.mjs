import test from "node:test";
import assert from "node:assert/strict";
import { beginPublication } from "../src/project-os.mjs";
import { workHealth, pulseWork, writeOwnedHealth, checkpointPublicationAttempt, settlePublicationAttempt } from "../src/runtime-safety.mjs";

const policy = { now: 500, maxPulseAge: 20, maxCompletionAge: 50 };
const running = { status: "running", startedAt: 100, pulseAt: 490, deadline: 600 };

test("bounded long work is live without claiming successful completion", () => {
  assert.deepEqual(workHealth(running, policy), { healthy: true, reason: "bounded_work_running" });
  assert.equal(workHealth({status: "completed", completedAt: 100}, policy).reason, "completion_stale");
});

test("fresh pulses cannot renew an operation deadline or hide stale work", () => {
  const pulse = pulseWork(running, 599);
  assert.equal(pulse.deadline, 600);
  assert.equal(workHealth(pulse, {...policy, now: 600}).reason, "operation_overdue");
  assert.throws(() => pulseWork(pulse, 600));
  assert.equal(workHealth({...running, pulseAt: 450}, policy).reason, "pulse_stale");
  assert.equal(workHealth({...running, pulseAt: 501}, policy).reason, "invalid_record");
  assert.equal(workHealth({...running, deadline: Infinity}, policy).reason, "invalid_record");
  assert.equal(workHealth({status: "failed"}, policy).healthy, false);
});

test("old or expired owners cannot overwrite running or terminal health", () => {
  const state = {lease: {owner: "worker-b", generation: 2, expiresAt: 700}, health: running};
  for (const record of [running, {status: "completed", completedAt: 500}, {status: "failed"}]) {
    const result = writeOwnedHealth(state, {claim: {owner: "worker-a", generation: 1}, record, now: 500});
    assert.equal(result.accepted, false);
    assert.equal(result.state, state);
    assert.equal(writeOwnedHealth(state, {claim: state.lease, record, now: 700}).accepted, false);
  }
});

test("terminal publication and lease release are a single owned transition", () => {
  const state = {lease: {owner: "worker-a", generation: 1, expiresAt: 700}};
  const result = writeOwnedHealth(state, {claim: state.lease, record: {status: "completed", completedAt: 500}, now: 500, release: true});
  assert.equal(result.state.lease, null);
  assert.equal(result.state.health.status, "completed");
  assert.equal(writeOwnedHealth(result.state, {claim: state.lease, record: running, now: 501}).accepted, false);
  assert.throws(() => writeOwnedHealth(state, {claim: state.lease, record: running, now: 500, release: true}));
});

const initial = () => beginPublication({taskId: "DEMO-7", trackerTitle: "Fictional task", fingerprint: "fictional-contract", lifecycle: "review", cycle: 1, turnId: "fictional-turn"});
const absent = receipt => ({state: "absent", canonicalTaskId: receipt.canonicalTaskId, turnId: receipt.turnId, attempt: receipt.attempt});

test("a deferred publication retry checkpoints again before any send", () => {
  const receipt = initial();
  const first = checkpointPublicationAttempt(receipt, absent(receipt)).receipt;
  assert.equal(first.state, "attempting");
  const deferred = settlePublicationAttempt(first, {key: first.key, attempt: 1, outcome: "not_started"});
  assert.equal(deferred.state, "deferred");
  const retry = checkpointPublicationAttempt(deferred, absent(deferred)).receipt;
  assert.equal(retry.attempt, 2);
  assert.equal(retry.state, "attempting");
  assert.equal(retry.key, first.key);
  const uncertain = settlePublicationAttempt(retry, {key: retry.key, attempt: 2, outcome: "unknown"});
  assert.equal(uncertain.state, "ambiguous");
  assert.equal(checkpointPublicationAttempt(uncertain, {...absent(uncertain), state: "indeterminate"}).action, "stop");
});

test("stale attempt evidence and mismatched acknowledgements never grant retries", () => {
  const receipt = initial();
  const first = checkpointPublicationAttempt(receipt, absent(receipt)).receipt;
  assert.equal(checkpointPublicationAttempt(first, {...absent(first), attempt: 0}).action, "stop");
  assert.equal(settlePublicationAttempt(first, {key: "different", attempt: 1, outcome: "not_started"}).state, "ambiguous");
  assert.equal(checkpointPublicationAttempt(receipt, absent(receipt), {writerBusy: true}).action, "defer");
  const confirmed = settlePublicationAttempt(first, {key: first.key, attempt: 1, outcome: "confirmed"});
  assert.equal(checkpointPublicationAttempt(confirmed, absent(confirmed)).action, "stop");
});
