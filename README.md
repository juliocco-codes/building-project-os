# Building Project OS

Project OS is a personal work-dispatch system. It turns an informal intention into a scoped task, gives an agent the context and authority it needs, and brings the work back when human judgment is genuinely required.

The aim is to get more from personal AI without becoming the routing layer between every tool and agent. Instead of choosing a system, reconstructing context, and supervising each step, the user has one place to describe an outcome and one queue of decisions that need attention.

It is the system described in [Putting life on autopilot](https://juliocothon.com/essays/putting-life-on-autopilot).

## What this changes for the individual

- One conversation can become a properly scoped unit of work.
- Several tasks can progress without the user manually starting and routing every step.
- Personal context can be reused without being reconstructed for every tool.
- Research, comparisons, and drafts can return as useful first versions rather than open-ended agent activity.
- Purchases, messages, bookings, credentials, and physical actions can come back as explicit decisions.
- The user can see what is ready, active, waiting for review, or complete in one place.

## The core design

Project OS separates four things that are easy to blur together:

1. **Context:** durable facts and the minimum supporting evidence needed for this task.
2. **Authority:** what may be read, drafted, changed, purchased, sent, or booked.
3. **State:** whether the task is ready, planned, in progress, in review, completed, or blocked.
4. **Actor:** whether the next meaningful action belongs to the agent or the person.

The task board is the state machine, not the agent's memory. A scheduled dispatcher may pick up work only when the task is explicitly ready, assigned to the agent, sufficiently scoped, and delivered through a handoff the execution environment has actually accepted.

## Start here

1. Choose a task tracker with an API. The examples use generic issue-shaped JSON rather than requiring Linear.
2. Copy `workspace/skills/plan-task/` into the workspace used by your agent.
3. Rename `workspace/USER.example.md` to `workspace/USER.md` and replace the fictional defaults locally.
4. Begin with read-only or draft-only tasks. Do not begin with purchases, messages, bookings, or destructive actions.
5. Use the included validator before dispatching a task.
6. Run the dispatcher manually until its state transitions are predictable.
7. Add an operating-system-managed detached reconciler only after duplicate prevention and review handoffs work reliably. Do not host unattended writers or monitors in a visible conversation.

```bash
npm test
node src/cli.mjs validate examples/task.json
node src/cli.mjs dispatch examples/task.json
```

## The task contract

Every dispatchable task should state:

- the outcome, rather than only an activity;
- what is in and out of scope;
- the evidence or freshness requirements;
- the actions the agent is authorised to take;
- the actions that always require review;
- the next actor;
- what completion looks like;
- a stable identifier used to prevent duplicate runs.

If any of those are materially ambiguous, the task should return to planning rather than being guessed into execution.

## Automation levels

- **Fully automatable:** the agent may complete the defined outcome within explicit authority.
- **Partially automatable:** the agent may prepare the work but must stop for a decision, credential, identity check, purchase, message, booking, or physical action.
- **Non-automatable:** the useful next action belongs to the person. The system may remind or prepare context, but should not pretend to execute it.

The automation level is advisory. Authority is set separately and always wins.

## Design decisions

### One front door, specialist workers behind it

The user should not need to remember which model, agent, skill, or integration owns a capability. One user-facing agent can route to narrow workers, while the task retains the shared outcome and constraints.

### Minimum necessary context

Retrieve the smallest set of files needed for the task. A personal knowledge base is an index and source of durable facts, not permission to load every private document into every run.

### Observable handoffs

A task is not complete because an agent produced text. The result must be attached to the task, the state must change, and the next actor must be explicit. Otherwise work becomes stranded between systems.

### Review is a feature

Partially automatable work should stop at a crisp decision. A good handoff says what was done, what evidence was used, what was not done, and precisely what the person needs to decide.

### Idempotent dispatch

Scheduled checks must not create a new agent run every time they inspect the board. Give every initial dispatch, review, and correction a stable key containing the task, revision, cycle, and contract fingerprint. Write `pending` before sending, retry only `pending` or `failed`, and never resend a record already marked `sent` or `accepted`.

### Ready is authorisation, not proof of delivery

Moving a task to `ready` records that the contract was approved. It does not prove that a worker received it or that the execution environment accepted its authority. Keep an explicit initial-handoff record with `pending`, `sent`, `accepted`, or `failed` state. Move the task to `in_progress` only after acceptance is confirmed. If the handoff cannot be established, make that a visible blocker instead of reporting an empty successful run.

This distinction prevents two common bugs: work that looks active but was never started, and a scheduler treating tracker text as if it independently granted permission to act.

### Fingerprint the effective contract

Retries and amendments need a deterministic way to decide whether they still refer to the same work. Fingerprint the frozen baseline plus accepted amendments, not ordinary comments or lifecycle metadata. Normalize line endings, remove trailing whitespace on each line, trim surrounding blank lines, join amendments with a fixed separator, and hash the resulting UTF-8 text. A material scope or authority change produces a new fingerprint and therefore requires a new handoff.

### Separate orchestration, work, and review

The scheduler's control task should only inventory, correlate, and route work. Each task gets a persistent worker, and independent review gets a different persistent reviewer. Corrections return to the same worker; later review cycles return to the same reviewer. Reusing the control task as a worker or reviewer mixes authority, context, and audit records and can strand later work in the wrong conversation.

### Separate the four runtime planes

Keep these responsibilities independent even when one application implements several of them:

1. **Orchestration** is a detached, operating-system-managed reconciler. It inventories desired state, compares it with durable receipts, and schedules bounded work. It does not borrow the foreground or write lifecycle prose itself.
2. **Execution** happens in private worker and independent-review sessions. These sessions are durable across corrections but never compete for user attention.
3. **Publication** owns exactly one canonical user-facing task per tracked issue. Its stable identity is derived from the issue identity, its title exactly matches the tracker title, and it is reused for every lifecycle update.
4. **Delivery** sends an approved result through an external channel. Delivery success does not create, hide, bump, or replace the canonical task, and task visibility does not imply delivery.

This separation makes foreground safety a property of the architecture rather than a convention. Updating issue B must not navigate away from, focus, or otherwise alter the user's foreground issue A.

### Treat attention as an explicit side effect

Ordinary progress, successful delivery, and healthy scheduled reconciliation are quiet. Only an actionable human-owned blocker, a review request, or a genuine delivery failure should surface. Record a stable escalation key so the same condition surfaces once. Completion remains discoverable on the canonical task without synthetic messages, recency bumps, or notifications.

Recovery observers follow the same rule. A slow tool call or a missing view is
not proof of a pending approval. Discovery may collect diagnostics, but must not
open a task automatically. Only a verified request from its owner may produce an
approval alert; navigating to a task requires a deliberate user action. A
background-launch flag does not guarantee that the receiving application will
preserve its selected task.

### Checkpoint publication before performing it

For each lifecycle publication, derive a stable key from the task, effective-contract fingerprint, lifecycle, cycle, submitted head, and intended turn. Persist a `prepared` receipt containing both the canonical task identity and intended turn identity before calling an external system. Refuse to start the side effect if either identity is missing.

After interruption, query exact evidence:

- if the exact canonical task and turn exist, confirm the receipt without sending;
- if exact evidence proves the turn absent, publish once using the same identity and key;
- if the result is indeterminate or mismatched, stop with one precise blocker.

Never blindly retry a timed-out publication. "Probably absent" is not evidence of absence.

If the canonical task has an active writer, defer delivery and retain the same
publication receipt and incident identity. Retry when available only if evidence
proves that publication did not start. A busy task must not cause an interruption,
a competing task, or a fresh incident. Unknown outcomes still require reconciliation.
If health recovers before an alert is delivered, cancel the obsolete alert.

Deferral is not permanent permission to retry. **Every attempt**, including a
retry after a definite pre-send rejection, first persists a new `attempting`
checkpoint. Bind acknowledgements and fresh absence evidence to that attempt;
an uncertain response removes retry permission. `checkpointPublicationAttempt`
and `settlePublicationAttempt` in `src/runtime-safety.mjs` model these transitions.
The adapter must atomically compare-and-save the proposed receipt before sending;
these pure functions do not persist state or make concurrent sends safe by themselves.
Absence must be authoritative (not an eventually consistent list missing an item).

### Bound work and isolate failures

Give each work item a durable lease with an owner, expiry, and monotonically increasing generation. A stale lease may be replaced after expiry, but its old owner cannot release the replacement. Bound each execution attempt by time or work budget, and catch failures per item so one broken issue cannot stop full-queue reconciliation.

A separate detached supervisor checks reconciler health. It emits one escalation per stable failure key, suppresses repeats while the condition persists, and silently rearms after recovery.

Do not equate a missing recent completion with a dead controller. Distinguish
`running`, `completed`, and `failed`: an in-flight operation needs a fresh pulse
**and a fixed deadline**. Pulses never extend that deadline. A new operation
requires a new explicit bound; routine bookkeeping should have a shorter bound
than useful long-running work. A fresh pulse proves controller liveness, not
worker progress or successful task completion. The deterministic `workHealth`
and `pulseWork` examples use caller-supplied time and policy values, not a daemon.

Fence **all health writes**, not just lease release, to the current owner and
generation. Persist terminal health before releasing ownership, ideally in the
same transaction. `writeOwnedHealth` models that atomic state transition;
production storage must enforce its compare-and-swap, not merely read a token
and later perform an unconditional write. After takeover, a suspended old owner
must be unable to publish health or perform other side effects. A local runtime
without enforceable fencing should not replace a known-live owner based on
stale timestamps alone. Package and test every new runtime dependency through
the normal deployment path, not only a manual patch.

### Guard automatic source integration

Automation classification never grants authority. Automatic merge is eligible only when all of these are true:

- the task is Fully automatable and its frozen contract explicitly grants merge authority;
- an independent reviewer approved the exact task, effective contract, cycle, and submitted head;
- every required check passed;
- the submitted head is unchanged and the target branch still equals its recorded expected head;
- no conflict exists and branch protection accepts the operation.

The merge key binds the task, effective contract, cycle, submitted head, review result, merge target, and expected target head. After merging, verify that the intended head reached the intended base before marking work complete. Status, labels, pull-request state, reviewer prose, or the automation classification alone are never authority. Missing evidence, ambiguity, drift, conflict, failed or pending checks, or protection refusal stops with one precise blocker. Partially automatable work always stops for human approval.

### Reconcile the whole queue

A dispatcher is a reconciler, not an activity-feed consumer. Every run should paginate the complete actionable population, then compare desired state with recorded state. Updated-time deltas can permanently miss a task after a transient failure. Stay quiet only when the full inventory proves that there is no action, failure, or unresolved handoff.

### Pair transitions with confirmed side effects

Do not move a task to `in_progress` and hope task creation succeeds. Confirm the dispatch, then pair that evidence with the state transition. The same rule applies to review, correction, and completion. Compensating rollbacks are useful recovery tools, but they should not be the normal control flow.

## Failure modes worth testing

- A `ready` task has an approved contract but no accepted worker handoff.
- A send times out after the `pending` record is written and the next heartbeat retries it.
- A `sent` review or correction is seen again on a later heartbeat and is not duplicated.
- A line-ending-only edit leaves the contract fingerprint unchanged.
- An accepted amendment changes the fingerprint and invalidates the old handoff.
- The control task, worker, and reviewer are accidentally given the same identifier.
- A task falls outside an updated-time window after a transient API failure but is recovered by full reconciliation.
- Two correction cycles reveal the same invariant failure and trigger a root-cause review rather than another local patch.
- A publication call times out and exact evidence cannot establish whether its turn was created.
- A stale lease holder attempts to release a replacement lease.
- External delivery succeeds while the canonical task remains unchanged and discoverable.
- A repeated dispatcher failure is escalated once, then rearms after recovery.
- An approval names an older source head or the target branch drifts before merge.
- A recovery observer repeatedly sees a long-running tool or private subagent and never navigates or sends a speculative approval alert.
- A supervisor encounters a busy canonical task, retains one pending incident, and publishes once after the writer finishes.
- Health recovers while an alert is deferred, making delivery unnecessary.

Validate the whole installed system with auxiliary approval and recovery services
enabled, including duplicate-service detection. Exercise ordinary tools, private
subagents, genuine approval interactions, and explicit user navigation while a
different application is foreground. Record application activation separately
from task selection. Task-switch logs alone cannot distinguish user clicks from
unsolicited navigation. The deterministic tests here validate decisions; they do
not certify a host application's focus behavior or substitute for a live approval test.

Keep acceptance claims proportional to the evidence:

| Evidence | Establishes | Does not establish |
| --- | --- | --- |
| Fresh bounded pulse | Controller is alive within an operation window | Worker progress or completion |
| Healthy cycle selecting no work | Reconciliation completed | Worker → review → integration progression |
| No-focus observation with no approval request | No observed switch in that window | Approval presentation or response safety |
| Genuine approval request and user response | That recorded approval interaction | Every other integration or background service |

A complete integration test must exercise real eligible work through independent
review and verified integration. A real approval test must record the request,
its response and any deliberate user navigation, and separately observe app
activation and selected-task changes. Keep sensitive live evidence private;
publish only generic criteria and fictional fixtures. Do not weaken approval
policy or substitute a synthetic notification just to declare acceptance passed.

## Repository map

- `workspace/AGENTS.md`: operating rules and authority boundaries.
- `workspace/USER.example.md`: fictional defaults to replace privately.
- `workspace/skills/plan-task/SKILL.md`: workflow for turning an intention into a task contract.
- `src/project-os.mjs`: validation, dispatch eligibility, state transitions, and review handoffs.
- `src/cli.mjs`: command-line entry point for the deterministic layer.
- `test/`: executable tests for authority and state-machine behavior.
- `examples/task.json`: a fictional partially automatable task.
- `examples/review-handoff.md`: the expected review format.
- `SECURITY.md`: privacy and automation-safety checklist.

## License

Available for personal and non-commercial use. See `LICENSE` for details.
