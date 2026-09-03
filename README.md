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
7. Add a scheduled heartbeat only after duplicate prevention and review handoffs work reliably.

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
