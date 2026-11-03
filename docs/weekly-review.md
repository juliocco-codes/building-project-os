# A weekly review with one late source

“I'm editing a field guide. What should I decide this week? If the research
arrives later, tell me which recommendation it changes.”

## Try the contract

Run these commands from the repository root.

```sh
node src/cli.mjs validate examples/weekly-review.json
node src/cli.mjs dispatch examples/weekly-review.json
```

Expect `valid: true` and then `eligible: true` with reason `dispatch`. The
[fixture](../examples/weekly-review.json) supplies a fictional accepted handoff.
Both commands inspect the contract locally. Reading a calendar, persisting
progress, waking a worker and delivering a result require adapters.

## First review

| Expected input | Evidence in this example |
| --- | --- |
| Project notes | The editor needs to choose a glossary location and a format for the map. The draft assumes readers have reliable internet. |
| Project calendar | A successful query for this review period returned zero deadlines. |
| Research update | The report is expected but has not arrived. Connectivity remains an open question. |

> **Two decisions for you.** First, I recommend putting the glossary beside the map so readers can use both together. Second, I provisionally recommend a linked map to keep the guide short. That assumes readers can get online in the field.
>
> I checked the project calendar and found no deadlines in this period. The research update is still pending. Would you approve the glossary placement and leave the map decision open until the report arrives?

An adapter would retain this checkpoint under the same review and revision:

| Item | Retained state | Next action |
| --- | --- | --- |
| Notes and calendar | Completed, with source version or query window and check time | Reuse while fresh. Recheck if the source changes or the coverage window expires. |
| Map decision | Provisional, research pending | Resume when the report becomes available. The editor owns the choice. |
| First review | Draft prepared | Record a delivery receipt only if a separately authorized delivery is confirmed. |

## Follow-up

The research arrives: readers tested the guide on a trail with no mobile signal.
The glossary recommendation still stands. The agent drafts this update:

> **Map decision updated.** The field test found readers couldn't open the linked map on the trail. I now recommend including a printable map. Shall I revise the draft to include it?

The editor can approve a draft change. Sending the review or publishing the guide
requires its own authority. The [fixture test](../test/weekly-review.test.mjs)
covers the review handoff using the existing helpers.

## Adapter acceptance cases

| Exercise | Passing observation |
| --- | --- |
| Return zero results from a successful calendar query, then repeat with an unavailable calendar. | Only the first review may say there are no deadlines. The second names the gap and leaves the check outstanding. |
| Interrupt processing after the notes and calendar checkpoints. Restart before those inputs expire. | Completed work survives. The worker resumes the research check. A changed source version or expired window triggers a fresh check for that source. |
| Introduce the research after confirmed delivery of the first review, then replay the same research event. | The first event produces one amendment tied to the map decision. Replay creates no second delivery. If delivery evidence is ambiguous, reconcile before retrying. |
