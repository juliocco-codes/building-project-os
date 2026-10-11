# Knowledge that survives the conversation

This is a deployment design with fictional examples. The repository does not implement a knowledge collector, relationship database, propagation ledger, file writer, or scheduler for this workflow.

## Retrieve relevant context

Use a [context index](../workspace/context/context-index.example.md) to route a task to its canonical owner. A wiki provides maintained synthesis and navigation; original documents, live systems, and domain databases provide evidence. Preserve dates and disagreements rather than blending conflicting claims.

Keep facts, instructions, and work state distinct. A contact detail is not permission to send a message. A proposed plan is not a commitment. An unaccepted draft is not a writing preference. Engine-local memory should point to shared records rather than creating another authority.

## Propagate accepted decisions

With explicit internal-maintenance authority, a consequential decision should reach the records future work depends on. The agent identifies those destinations.

1. Record the decision, source, effective date, scope, sensitivity, and superseded claims. Tentative discussion remains a proposal.
2. Identify the canonical owner and affected summaries, standing rules, existing commitments, or installed consumers. Read their local instructions.
3. Update each destination through its owner's workflow, checking the expected prior version. Do not overwrite a concurrent change.
4. Record applied evidence or a pending reason for each destination. A ledger entry alone does not establish propagation.

The [decision example](../examples/decision-propagation.json) illustrates the record shape. Corrections append history while current views show the effective decision. Preserve provenance. A new instruction does not erase earlier failures or expand external-action authority. Source review, integration, installation, and observed behavior remain separate when system rules change.

## Carry work between sessions

Checkpoint substantial work during execution, particularly after a consequential effect. A credit limit may prevent a final handoff. Record the objective, existing work record, accepted authority, artifacts and revisions, completed effects, uncertainty, blockers, and next action. See the [work checkpoint](../examples/work-checkpoint.json).

Before continuation, refresh relevant decisions and changed instructions, inspect artifact versions, and reconcile uncertain effects before retrying. A checkpoint grants no new permission. Preserve the existing task or user-selected execution document. Another engine may lack a tool or credential; use an authorized equivalent or report the missing capability.

## Bounded maintenance authority

The default is proposals only. A user may explicitly authorize internal updates for supported facts and accepted corrections. Name the approved sources, destinations, fact types, sensitivity, retention criteria, and conflict handling before enabling writes. Maintaining a relationship record does not authorize messages, bookings, deletion, public posts, or changes to authority.

Separate collection, interpretation, and application. A collector supplies bounded evidence. An author proposes structured changes with source references. A writer checks policy, allowed paths, schema, identity, and expected prior versions, then records each result. The author cannot expand its allowed targets. Policy, credentials, startup instructions, and execution authority require their own explicit change process; third-party text cannot rewrite them.

Use the domain's transactional helper for relationship records. Preserve identity confidence, sensitivity, affiliations, and source dates. Close fulfilled open loops with evidence and supersede outdated facts without erasing history. Exact contact values and sensitive facts stay out of generated profiles. Ordinary conversation and speculative personality assessments do not merit retention.

## Weekly reconciliation

Immediate propagation handles clear decisions as they happen. A weekly review catches missed changes and stale summaries across approved sources.

- Keep per-source cursors and covered intervals. Bound each review and record unreviewed history.
- Distinguish checked with no changes, applied changes, partial coverage, unavailable sources, and unresolved conflicts. Do not advance past unprocessed evidence or report an inaccessible source as empty.
- Confirm source freshness before relying on recent communications. Select consequential people and facts; do not copy whole mailboxes or conversations.
- Reconcile pending propagation and unresolved relationship loops. Silence or age alone is not completion evidence.
- Retain application receipts before publishing a summary. If publication fails, retry from those receipts without applying the changes again.

Keep routine no-change runs quiet. Surface actionable uncertainty or failed writes under the user's notification policy. An installed procedure does not prove a successful unattended run. Record observed coverage and outcomes during ordinary use.

## Public boundary

Publish generic procedures and fictional fixtures. Personal context, voice samples, identities, communications, checkpoints, and application receipts remain in private stores. Public source control is not their backup.
