# Run a weekly review with one late source

The fictional field guide needs a glossary and a map. This starter checks three
local fixtures, keeps a checkpoint between commands, and drafts decisions for an
editor. It uses deterministic templates, not an AI model. Nothing leaves your
computer. Node.js 20 or later is the only requirement; `npm install` is unnecessary.

## Create the review

Run from the repository root on a local macOS or Linux filesystem:

```sh
npm run verify
mkdir -p state
node src/cli.mjs weekly init state/weekly
node src/cli.mjs weekly review state/weekly
```

The directory must not already exist. `init` refuses to overwrite even a partial
run. `state/` is ignored by Git. For another exercise, use a new directory there.

The JSON output contains a readable `artifact` and its `artifactHash`:

- Notes recommend placing the glossary beside the map.
- A successful calendar query returns zero deadlines. Unavailable calendar data
  instead produces an explicit coverage limitation.
- Research has not arrived, so the linked-map recommendation is provisional.
- The next actor is the human editor. Review does not grant delivery authority.

Running `review` again reuses unchanged checks for 24 hours. A changed source or
expired check produces a new artifact hash and requires new approval. This is a
fixed teaching policy, not a general scheduling or freshness system.

## Approve the exact draft

Read the artifact, including its coverage limitations. Replace `PASTE_HASH_HERE`
with the hash from that output. The two choices this fixture can recommend are
`linked` and `printable`; approval must match the current recommendation.

```sh
node src/cli.mjs weekly approve state/weekly PASTE_HASH_HERE linked --mock-delivery
node src/cli.mjs weekly deliver state/weekly
node src/cli.mjs weekly status state/weekly
```

The command records the editor's map decision and separately names consent to
mock delivery of that exact artifact to the fixed `mock-editor-inbox`. It does not
edit or publish a field guide. To reject the recommendation, do not approve it;
revise the fictional evidence and run `review` again. This starter has no editing
UI, authenticated human identity, or general decision engine.

Expect `stage: "delivered"` and `mockDeliveries: 1`. A second `deliver` reports
`reconciled: true` and still one mock delivery. Inspect `provider.json` to see the
mock inbox contents. A checkpoint saying “delivered” alone is insufficient.

## Add the late research and recover a crash

```sh
node src/cli.mjs weekly late state/weekly
node src/cli.mjs weekly review state/weekly
```

Research now reports no mobile signal on the fictional trail. The map changes to
`printable`; unchanged, fresh notes and calendar checks carry forward. The old
receipt stays in checkpoint history, while the new draft awaits approval. Copy
the new hash and approve the revised decision:

```sh
node src/cli.mjs weekly approve state/weekly PASTE_NEW_HASH_HERE printable --mock-delivery
node src/cli.mjs weekly deliver state/weekly --crash-after-provider
node src/cli.mjs weekly deliver state/weekly
node src/cli.mjs weekly status state/weekly
```

The crash command intentionally exits with code 1 after the provider has committed
the effect but before the worker has saved its receipt. The next command finds
that exact provider entry, repairs the checkpoint, and reports two total mock
deliveries: the original draft and its approved amendment. It does not deliver
the amendment twice. Repeating `late`, `review`, and `deliver` within the freshness
window leaves that count unchanged.

You can also use `--crash-before-provider` on an approved, undelivered draft. It
stops after saving `attempting` but before the mock effect. If the sources stay
current, `deliver` resumes that operation. If research changes or a check expires,
`deliver` first verifies absence in the intact mock provider, records the attempt
as `confirmed-unsent`, and returns `awaiting-review` without sending the stale
draft. Run `review` and approve the new hash. Missing, malformed, or mismatched
provider evidence blocks recovery; it does not establish absence.

This simulated interruption releases the local process lock. A real terminated
process may leave `.lock` behind. Follow the [recovery guide](operating-lessons.md#backup-and-restore)
before removing it. Local atomic rename and exclusive ownership do not constitute
a distributed transaction or a production exactly-once delivery guarantee.

## What each file owns

| File | Responsibility | Trust assumption in this exercise |
| --- | --- | --- |
| `sources.json` | Fictional notes, calendar and research | Untrusted structured data; no actions or destinations accepted from it |
| `checkpoint.json` | Current artifact, source checks, grant reference, stage and prior receipts | Worker claims; delivery requires validation against the registries |
| `authority.json` | Accepted grants for exact artifact, contract, decision and destination | Synthetic human authority; the CLI approval command writes it |
| `provider.json` | Mock delivered artifacts and their exact receipts | Synthetic provider authority, including authoritative absence under the local lock |
| `.lock/` | Exclusive local command ownership | Never automatically stolen; a crash can require manual recovery |

All four JSON files are editable by the same OS user. These are separate logical
roles, **not a security boundary**. A user or agent with that user's permissions
can call `approve`, alter the registries, or replace the program. See the
[threat model](../SECURITY.md#local-starter-trust-model) before adapting the example.

## Adapter acceptance cases

The [local workflow tests](../test/local-weekly-review.test.mjs) exercise persisted
restart, late-source replay, coverage gaps, expiration, forged worker claims,
changed content, receipt mismatch, exclusive ownership, and crash reconciliation.
Instruction-like text in a fixture stays data; this proves no model injection defense.

A real adapter must additionally prove authenticated source coverage, separate
accepted-grant and provider authority, atomic provider idempotency, authoritative
absence versus unknown outcomes, concurrent fencing, backup restoration without
resending real effects, and review by an independent identity. Do not equate
passing local tests with those production properties.

The original helper-only commands remain available:

```sh
node src/cli.mjs validate examples/weekly-review.json
node src/cli.mjs dispatch examples/weekly-review.json
```

They inspect the fictional contract and accepted-handoff fixture without writing state.
