# Preserve evidence across review and recovery

These are generic operating patterns for a connected system. The local starter
implements only the checkpoint and mock delivery example described in the
[walkthrough](weekly-review.md). None of these patterns installs services or
provides automatic failover, backup, or independent review.

## Bind quality review to the artifact

Before starting production, define the intended reader, claim, evidence, format,
and acceptance checks. Review the artifact the user will actually receive:
render a document, play an audio file, inspect a video, or exercise an interface.
A successful export and a worker's completion message do not establish quality.

Keep a review record with the artifact hash or exact source commit, relevant
checks, reviewer identity, limitations, and disposition. Changed bytes invalidate
that review. Review publication authority separately; a quality pass does not
authorize sending. A different process is not an independent reviewer if the
worker can forge its identity or approval record.

Acceptance exercise: alter one byte after approval. Delivery or integration must
stop until the new artifact receives the required review. Preserve the rejected
version and explanation as history; do not relabel it as having passed.

## Prepare failover before work starts

Keep the task outcome, accepted authority, canonical source locations, retained
artifact hashes, stage, verified effects, uncertain attempts, and next action in
a checkpoint that the fallback can access. Save it before consequential work,
not only in a final message that may never arrive. Keep credentials outside it.

At takeover, the new engine reads current instructions and the checkpoint, checks
whether the earlier worker still owns execution, and reconciles exact provider
evidence. It must not start a second delivery because a conversation ended or a
tool timed out. If the provider cannot establish whether an operation occurred,
retain uncertainty and stop that effect. A different model on the same exhausted
account is not an independent quota fallback.

Acceptance exercise: interrupt after a provider commits but before the local
receipt. A fresh process must repair the receipt from provider evidence without
regenerating or resending the retained artifact. The local walkthrough demonstrates
this case with a mock provider only.

## Give each fact and result one canonical owner

Choose one authority for each kind of record: accepted decisions, current task
state, source evidence, retained artifacts, and provider effects. A readable
summary, search index, or dashboard is a derived view; record which source version
it represents. Two independently editable copies make recovery ambiguous.

Keep one user-facing location for the task's result and decisions. Background
workers can remain private. Publication, delivery, notification, and foreground
navigation are separate operations, each with its own evidence and authority.
Restoring a dashboard must not send a notification or create another task.

Acceptance exercise: rebuild a derived view from canonical records and compare
its source version. A stale view must be recognizable without changing accepted
decisions or provider receipts.

## Backup and restore

Synchronization can propagate deletion or corruption. It is not an independent
backup. Define the private records, retention period, encryption and access rules,
backup owner, restore destination, and verification interval. Keep secrets under
the credential system's own recovery policy. Do not commit live backups here.

For a **fictional local exercise**, stop commands, confirm no process owns the
workspace, and copy the entire state directory to another private local folder.
Keep source fixtures, authority, provider and checkpoint together. Restore into
a new directory, run `status`, then reconcile any pending `deliver`. Compare
artifact hashes and mock delivery counts against the original. Never merge two
independently modified copies or use a partial snapshot to establish absence.

If a real process died while holding `.lock`, verify that no owner remains before
removing that directory. The program never steals it automatically. An incomplete
initialization or unreadable JSON is a blocker; preserve it for diagnosis and use
a new directory for a new fictional exercise.

In a connected deployment, a restored worker database is not the provider's
history. Real effects may have happened after the backup. Preserve stable operation
keys, query the provider's current authoritative ledger, and fence stale workers
before resuming. Never restore an old provider snapshot and infer that missing
effects were unsent. If the provider cannot resolve the exact operation, hold the
operation for human reconciliation instead of retrying.

Acceptance exercise: restore an older worker checkpoint while the provider retains
a later effect. Recovery must acknowledge that effect once. A restore that loses
the provider evidence must remain blocked, not start a replacement delivery.
