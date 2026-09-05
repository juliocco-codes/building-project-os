# Reference architecture and production lessons

This repository is a small, sanitized starting point for a personal work system.
Its JavaScript implements task validation, readiness and handoff checks, stable
dispatch keys, contract fingerprints, and a human review handoff. It has no live
scheduler, database, task-client adapter, notification service, credential broker,
delivery provider, independent-review runner, or source integrator.

The following boundaries describe what a production deployment needs. They are
lessons and acceptance requirements, not claims that the example implements them.

## Execution, publication, and attention

Run scheduling and supervision as OS-managed processes with bounded operations,
durable checkpoints, and exclusive leases. Do not use an active visible
conversation as the scheduler's execution transport. A periodic UI heartbeat can
itself interrupt the user even when the worker never calls a navigation API.

Give each issue one canonical user-facing conversation with a stable identifier
and title. Keep a reusable private implementation worker and a distinct reusable
reviewer. Corrections return to those identities. Publish only bounded results,
decisions, and user-action requests into the canonical conversation.

Execution completion, result publication, list discoverability, notification,
and foreground selection are separate states. A loaded conversation may retain
writer ownership between turns. Persist a deferred publication when ownership is
unavailable; never steal locks or report that deferred result as delivered.

Test both application focus and selected conversation while another app is
foreground. Also test private workers, reviewers, later updates, actual permission
prompts, mobile discovery, and restart persistence. Logs alone cannot distinguish
the user's click from an automatic focus change. A passing case proves only the
path observed, not every client or tool interaction.

## Authority, independent review, and integration

A task's state or automation level cannot create authority. Bind execution to its
accepted contract and amendments. Keep credentials access distinct from permission
to perform a particular external effect.

Automatic source integration requires explicit contract authority, a submission
bound to repository/base/commit, independent approval of that exact commit, and
successful required checks. Recheck current head, protection, and mergeability
before an idempotent merge; verify the result reached the intended base afterward.
Changed heads, conflicts, failed checks, or missing evidence stop with a blocker.
An uncertain merge response requires read-only reconciliation, not another merge.
Deployment remains a separate authorized effect with rollback and fresh health
verification. None of these production integration operations is implemented here.

## Scheduled delivery

Use deterministic preflight to decide whether source material is eligible before
starting model work. Checkpoint schedule slots and use per-workflow exclusion.
Collect credentialed sources through a bounded trusted adapter; give authoring
workers only the minimum evidence they need, preferably a hash-verified snapshot.

Declare visibility independently of execution and delivery:

| Policy | Routine successful result | Exception |
|---|---|---|
| User-facing | Keep the intended visible result; external delivery may also be authorized | Keep a concise diagnostic accessible |
| Exception-only | Stay quiet | Publish a stable actionable exception |
| External delivery | Hide routine execution after trusted delivery and state evidence | Preserve missing, partial, or uncertain delivery |

A provider attempt or model statement does not prove delivery. Trusted receipts
bind source identity and exact content; state advances only after required receipts
are complete. Delivery-only repair reuses retained verified content. Confirmed
unsent parts may resume; uncertain outcomes stop to prevent duplicates.

Notification policy is also separate. Routine starts, progress, review by another
agent, and retries should stay quiet. User-owned blockers and review requests can
request attention; completion can remain visible without a push. Do not reuse an
external deliverable channel, such as Telegram, for task lifecycle notifications
unless the user has separately chosen that behavior.

## Liveness and evidence

A supervisor should observe bounded liveness independently of the worker and
deduplicate sustained failures. Its recovery notification should not create a
new foreground interruption. A pulse proves the controller is alive, not that
authorized work advanced. Audit actionable work against durable records so a
healthy no-op cannot conceal a stranded handoff.

Record implementation, review, merge, deployment, live health, delivery, and
publication separately. Retain uncertainty and historical failures rather than
rewriting them as success after a later recovery.

## Public and private source

This public repository is a standalone sanitized reference implementation, not
an alternate remote or release branch for a private operational system.
Develop public contributions from this repository's own clean base. Never copy
private preservation commits, real receipts, personal memory, machine-specific
configuration, or credentials into it. A private deployment can maintain its own
adapters and state without publishing them. Review outgoing history as well as
content; later deletion does not remove sensitive data from earlier commits.
