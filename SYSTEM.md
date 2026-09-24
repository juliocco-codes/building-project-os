# Reference architecture and production lessons

This repository is a small, sanitized starting point for a personal work system.
Its JavaScript implements task validation, readiness and handoff checks, stable
dispatch keys, contract fingerprints, a human review handoff, publication
closeout planning and audit, input-based permission tiers, and pure decision
helpers for publication recovery, leases, bounded health, attention, and integration
eligibility. These helpers perform no external effects. It has no live
scheduler, database, task-client adapter, notification service, credential adapter,
delivery provider, independent-review runner, or source integrator.

The following boundaries describe what a production deployment needs. They are
lessons and acceptance requirements, not claims that the example implements them.

For the executable examples, start with [task and dispatch helpers](src/project-os.mjs),
[runtime-safety helpers](src/runtime-safety.mjs), and the [CLI](src/cli.mjs).
The later patterns for [schedule recovery](#missed-slots-and-dependencies),
[review carryover](#complete-review-carryover), [decision history](#decision-history-and-generated-views),
and [effective amendments](#identity-and-effective-amendments) require deployment-specific
storage and adapters; they are documentation only here.

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

### Permission tiers by input trust

Decide an agent's runtime permissions by who wrote its inputs, not by how risky
the task sounds.

- **Trusted tier.** Planning, coding, dispatch, review and integration work whose
  inputs come from the user, their own repositories and their own files. These
  agents run with the user's ordinary tooling: normal Git and GitHub CLI access,
  package managers, local services and installs. What they may *do* is still
  bounded by the accepted contract, independent review and explicit approval for
  external effects. The runtime does not need to re-enforce those rules.
- **Restricted tier.** Any agent that reads text written by third parties (email,
  chat messages, social notifications, web pages, shared documents) runs in a
  sandboxed profile. It has no credentials and no repository or package writes,
  and its output is limited to proposals and drafts for a trusted agent or the
  user to act on. A prompt injection in an email should at most produce a bad
  proposal.

Keep the tiers separate by task, not by instruction. A trusted agent that needs
third-party content receives it as data from a restricted agent's output, never
by browsing or reading the inbox itself.

Do not engineer around a sandbox to make a trusted agent do ordinary work.
When a basic task (fetching a repository, opening a pull request, installing a
reviewed service) needs a new subsystem to get through the runtime's
restrictions, move that task to the trusted tier instead. Bespoke brokers,
approval relays and host-network workarounds become permanent infrastructure
to maintain, and each drifts and fails independently.

## Scheduled delivery

Use deterministic preflight to decide whether source material is eligible before
starting model work. Checkpoint schedule slots and use per-workflow exclusion.
Collect credentialed sources through a deterministic adapter and give authoring
workers only the minimum evidence they need, preferably a hash-verified snapshot.
The adapter is the single place secrets are injected and logged, and authoring
cannot silently refetch. Without separate operating-system identities it is a
convention, not a wall: in the trusted tier, an agent with the user's permissions
could read the same secrets.

Receipts prove delivery only if the authoring agent could not have written them.
Either the delivery service owns its receipts under a separate identity or key
the agents cannot read, or the deployment accepts that receipts are only as
trustworthy as its agents and says so. Restricted-tier agents must never be able
to write receipts.

Declare visibility independently of execution and delivery:

| Policy | Routine successful result | Exception |
|---|---|---|
| User-facing | Keep the intended visible result; external delivery may also be authorized | Keep a concise diagnostic accessible |
| Exception-only | Stay quiet | Publish a stable actionable exception |
| External delivery | Keep routine execution quiet after trusted delivery and state evidence; retain the canonical task's discoverability | Preserve missing, partial, or uncertain delivery |

A provider attempt or model statement does not prove delivery. Trusted receipts
bind source identity and exact content; state advances only after required receipts
are complete. Delivery-only repair reuses retained verified content. Confirmed
unsent parts may resume; uncertain outcomes stop to prevent duplicates.

A retry must start from the durable stage and its evidence. Once paid generation
has produced a verified artifact, retain its content hash and source identity.
A receipt-only retry reconciles provider evidence and repairs the local receipt
or derived state; it must not repeat paid generation or resend an already delivered
artifact. If delivery is uncertain, use read-only reconciliation and retain that
uncertainty until authoritative evidence resolves it. Only confirmed unsent parts
may enter delivery-only repair using the same retained artifact. Missing or corrupt
content is a visible blocker, not permission to regenerate. A newly authorized
generation is separate work with its own cost and provenance.

Notification policy is also separate. Routine starts, progress, review by another
agent, and retries should stay quiet. User-owned blockers and review requests can
request attention; completion can remain visible without a push. Do not reuse an
external deliverable channel, such as Telegram, for task lifecycle notifications
unless the user has separately chosen that behavior.

### Missed slots and dependencies

Evaluate due slots in the workflow's declared timezone, including missed slots
earlier on the same local day. A restart between scheduled times must not make
that day's eligible work disappear. Record each slot's disposition durably and
keep the workflow's exclusion and idempotency checks in force during recovery.
Define daylight-saving behavior explicitly; a local date alone is not a unique
slot identity. Older days require an explicit catch-up policy.

When the accepted policy allows coalescing, combine redundant same-day slots into
one bounded run and record which slots it covers. Do not replay each missed slot
as a separate paid generation or delivery, or silently mark skipped slots as
delivered. For a fictional daily digest with morning and midday checks, an
afternoon restart can produce one current digest covering both missed checks if
neither already produced it and the policy permits this. Workflows that require
distinct outputs must retain those distinctions.

Resolve prerequisites before their consumers: collect eligible sources, validate
the evidence snapshot, generate and verify the artifact, deliver, then reconcile
receipts and derived state. A dependency being scheduled or running does not prove
its output is ready. Reuse verified current inputs, block consumers on missing or
failed prerequisites, and surface cycles or unavailable dependencies explicitly.
One blocked chain must not prevent unrelated eligible workflows from progressing.

## Complete review carryover

Build each review from the complete unresolved population, including earlier
reviews, pending decisions, and incomplete handoffs. Paginate the source and
reconcile stable item identities; neither an updated-time window nor a previous
summary is a complete inventory. If the inventory is incomplete, report that
limitation rather than implying that all open work was reviewed.

Carry every unresolved item into the next review unless the user explicitly
snoozed it. Preserve the snooze decision and its expiry or reactivation condition,
and bring the item back when that condition is met. Silence, age, an agent's
priority judgment, or omission from a previous summary is not a snooze or closure.
Evidence of completion, cancellation, or resolution can close an item. Deduplicate
repeated mentions without losing distinct decisions. A concise review may link
to a complete readable backlog; a short priority list must not hide the remainder.

Absent evidence is not an empty result. When a reader cannot open its source
(a missing tool, an unfamiliar storage format, a truncated page or a changed
content hash mid-pagination), report a coverage limitation for that source and
keep everything else. Never report "no open items" from a check that did not
complete. A fallback reader should be read-only, scoped to identifiers the
decision history already names, and fail visibly on format drift.

## Decision history and generated views

Keep an append-only decision history as the authority for recorded decisions.
Each event should identify the subject, decision, evidence, actor, recording time,
and any effective date or superseded decision. Corrections and reversals append
new events instead of rewriting the earlier rationale or turning an earlier
failure into success. Supersession preserves the earlier event and its provenance.

Generate machine-readable current state and a readable review view from that
history using a deterministic projection. Retain the source event position or
version in each view so stale or incomplete projections are detectable. Update
decisions through new events, then regenerate both views; do not manually edit
the derived state into a competing authority. Task-tracker lifecycle state and
execution receipts still have their own roles: a decision log alone proves
neither delivery nor completion.

On adoption, record the first evidenced baseline and its actual recording time.
Label an imported current-state snapshot as a baseline with unknown earlier
history. Import older events only where attributable evidence exists, distinguishing
the event's known time from the later import time. Do not invent past decisions,
dates, actors, or approval history to make a new ledger appear complete.

## Identity and effective amendments

Match a source document to the exact subject and agreement before applying its
terms: names or similar titles alone are insufficient. Check the relevant parties,
subject, agreement identity, and version against attributable evidence. An
unresolved identity mismatch blocks application; it must not silently amend a
different subject or broaden an agent's authority.

Preserve the baseline and each accepted amendment with its evidence, acceptance
time, effective date, and recording time. Resolve terms for an explicit as-of
date using the accepted amendments effective then and their documented precedence.
A newer upload or later recording time does not make an amendment effective early.
Missing dates, conflicting terms, or uncertain precedence need resolution; do
not guess retroactive effect. Distinguish historical terms from current ones.

For a wholly fictional agreement with Example Studio, an amendment accepted on
2030-04-08, recorded on 2030-04-09, and effective on 2030-05-01 does not change the
terms applicable on 2030-04-20. This example illustrates date selection only.
The `contractFingerprint` helper hashes supplied text; it does not match identities,
validate acceptance, resolve precedence, or choose date-effective amendments.
A production caller must do those checks before fingerprinting the effective
contract and seeking any newly required handoff or approval.

## Liveness and evidence

A supervisor should observe bounded liveness independently of the worker and
deduplicate sustained failures. Its recovery notification should not create a
new foreground interruption. A pulse proves the controller is alive, not that
authorized work advanced. Audit actionable work against durable records so a
healthy no-op cannot conceal a stranded handoff.

Record implementation, review, merge, deployment, live health, delivery, and
publication separately. Retain uncertainty and historical failures rather than
rewriting them as success after a later recovery.

| Evidence stage | What to record | What it does not prove |
|---|---|---|
| Source | Exact commit and relevant checks or review | That an installed service uses that commit |
| Deployed | Installed artifact or version, target environment, and rollout result | That the affected behavior has been exercised successfully |
| Verified | Observed behavior, exact deployed version, environment, test window, and scope | Untested paths, later deployments, or every client |

A source fix can be reviewed while deployment remains pending. A successful
deployment can still await behavioral verification. Keep these states visible,
and scope each verification to the version and path actually observed. A later
change does not inherit that evidence automatically; preserve earlier results
as history and identify the new checks needed. The tests in this repository prove
deterministic helper behavior only, not a deployed scheduler or delivery adapter.

### Trace running code to source

A merged change is not an installed change, and an installed change is not
necessarily merged. Services that run pinned copies outside the repository drift
quietly: a hot fix is applied on the host, a branch is deployed before review
finishes, or two services install different versions of one shared helper.
Keep a read-only inventory that hashes every installed file and reports which
source commit, if any, contains those exact bytes, alongside loaded services and
their latest outcomes. Treat "never committed" as a defect to capture before
the next deployment, because redeploying from source would silently remove it.
Record known drift explicitly instead of letting documentation claim parity.

Separate current instructions from dated incident reports. Handbooks describe
integrated behaviour and stable invariants; the inventory and receipts describe
what is running now. Status paragraphs copied into a handbook go stale and start
to compete with the evidence.

### Shared model quota is a common-mode failure

Every headless workflow, reviewer and dispatcher that draws on the same model
account fails together when its quota is exhausted. A model-capacity fallback
does not help: switching models is appropriate for a capacity rejection before
work starts, not for a usage limit on the account. Make quota exhaustion a
distinct, deduplicated exception with its reset time, pause non-essential
polling (especially minute-level reviewers) and keep a documented manual or
alternative-provider path for deliverables that matter. A worker that exits
successfully has not delivered anything; only a delivery receipt proves that.
Persist the watchdog's own explanation before it interacts with any external
catalogue, so a failed lookup cannot erase the diagnosis.

## Acceptance cases for deployment adapters

These are proposed checks for a deployment, not additional executable tests here:

- A crash after paid generation resumes from the retained artifact; receipt repair
  makes no generation call and confirmed delivery is not repeated.
- An ambiguous provider response remains unresolved until exact evidence arrives;
  a confirmed unsent part resumes without regenerating the content.
- A same-day restart coalesces only policy-compatible missed slots, records their
  disposition once, and runs consumers only after verified prerequisites.
- An older unresolved decision survives review pagination and prioritization;
  an explicitly snoozed item reappears at its recorded reactivation condition.
- A correction appends history, regenerates both views, and leaves the prior event
  readable; migration records an evidenced baseline without invented backhistory.
- A similar name cannot select another agreement, and a future-effective amendment
  cannot change today's terms or authority.
- A passing source test leaves deployment pending; deployment without an observed
  behavioral check leaves verification pending.
- Approved agent work with no accepted handoff is blocked before its blocker record
  is written; an audit flags ready or planned work with no closeout record.
- A reader that cannot open its source reports a coverage limitation, never an
  empty result.
- An agent reading third-party content runs without credentials or writes, and a
  planted instruction produces at most a proposal.
- An inventory run identifies every installed file that differs from the intended
  source, including files present in no commit.
- Exhausted model quota produces one exception with its reset time; capacity
  fallback is not attempted and no partial output is reported as delivered.

## Public and private source

This public repository is a standalone sanitized reference implementation, not
an alternate remote or release branch for a private operational system.
Develop public contributions from this repository's own clean base. Never copy
private preservation commits, real receipts, personal memory, machine-specific
configuration, or credentials into it. A private deployment can maintain its own
adapters and state without publishing them. Review outgoing history as well as
content; later deletion does not remove sensitive data from earlier commits.
