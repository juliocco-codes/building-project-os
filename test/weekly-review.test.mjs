import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beginWork, createReviewHandoff, dispatchDecision, validateTask } from "../src/project-os.mjs";

const fixture = new URL("../examples/weekly-review.json", import.meta.url);
const task = JSON.parse(readFileSync(fixture, "utf8"));

test("the weekly review fixture can enter work and return an open decision to its editor", () => {
  assert.deepEqual(validateTask(task), []);
  assert.equal(dispatchDecision(task).eligible, true);
  const active = beginWork(task, task.initialHandoff);
  const result = createReviewHandoff(active, {
    summary: "Glossary placement is ready for review. Map format is provisional.",
    evidence: ["Project notes", "Calendar checked for the review period: zero deadlines"],
    notDone: ["Research update pending"],
    decisionNeeded: "Approve glossary placement and defer the map choice?"
  });

  assert.equal(result.task.nextActor, "human");
  assert.equal(result.task.state, "in_review");
  assert.deepEqual(result.handoff.notDone, ["Research update pending"]);
  assert.deepEqual(result.task.authority.allowed, ["read", "draft"]);
  assert.equal(dispatchDecision(result.task).eligible, false);
});
