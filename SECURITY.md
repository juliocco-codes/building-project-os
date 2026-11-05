# Security and privacy

A personal task system can reveal relationships, routines, locations, finances, health information, travel, and account activity even when it contains no password. Treat the real workspace and task history as private by default.

Before committing any change:

- search for names, email addresses, phone numbers, addresses, calendar titles, travel details, issue identifiers, and local filesystem paths;
- search for API keys, OAuth tokens, cookies, bearer tokens, private keys, webhook URLs, and approval endpoints;
- inspect screenshots and example output for personal or commercially sensitive information;
- inspect the complete Git diff and repository history;
- never commit a real `.env`, task export, personal wiki, memory directory, browser profile, credential file, or dispatcher state database.
- keep account and data examples fictional, including for named third-party tools. Exclude production issue IDs, fingerprints, task or turn IDs, channel identifiers, endpoints, usernames, schedules, logs, or local paths;
- inspect deterministic receipts and fixtures as carefully as prose because identifiers and operational metadata can leak through test data;
- confirm that worker, reviewer, publication, delivery, and merge examples describe interfaces rather than private service schemas.

If a secret enters Git history, deleting it in a later commit is not enough. Revoke it immediately and clean the repository history before publishing.

## Authority boundaries

- Begin read-only and add one narrow write capability at a time.
- Treat sending messages, booking, purchasing, deleting, publishing, and changing permissions as separate authorities.
- Do not infer authority from the desired outcome.
- Require an explicit review handoff for identity checks, credentials, financial commitments, legal acceptance, or destructive actions.
- Make every automated run traceable to one stable task and revision.
- Never approve an agent's own request automatically.
- Treat automation classification, labels, status, reviewer prose, and pull-request state as descriptive data, never authority.
- Bind independent approval to the exact submitted head and effective contract, and invalidate it when either changes.
- Fail closed on ambiguous publication, delivery, review, or merge evidence instead of guessing or blindly retrying.
- Run unattended reconciliation and health supervision outside visible conversations so background work cannot seize foreground attention.
- Require current lease ownership for health and terminal-state writes as well as release; storage must enforce atomic fencing.
- Re-checkpoint every publication retry and bind evidence to its attempt; a timeout is not proof that nothing was sent.
- Keep live validation evidence private. Empty healthy cycles and tests without genuine approval requests must not be represented as end-to-end acceptance.
- Repair receipts from trusted evidence without repeating paid generation or confirmed delivery; missing artifacts and uncertain outcomes must remain visible blockers.
- Treat append-only decisions and their generated views as private operational data in a deployment. Publish only fictional examples, never reconstructed personal history.
- Match the exact subject and agreement, accepted authority, and effective amendment dates before applying terms; similar names and upload timestamps are insufficient.
- Keep source checks, deployment evidence, and observed behavioral verification distinct. Documentation of a pattern does not prove that an adapter exists.
- Assume any agent that reads third-party content (email, messages, web pages, shared documents) may be prompt-injected. Scheduled readers propose by default. Explicitly authorized internal maintenance uses approved sources, destinations, and fact types, preserves provenance, and rejects stale writes. It cannot modify its own authority or treat source text as instructions. External effects retain explicit confirmation requirements, whatever the agent's permissions.
- Keep communication archives, relationship records, voice samples, propagation ledgers, and checkpoints private. Publish fictional examples only. Shared skill text does not share credentials or another engine's tools.
- Never deploy code that exists in no reviewed commit.
- Receipts written somewhere an agent can write are not proof of delivery; give the delivery service its own identity or key.
- Do not schedule minute-level agent loops for review or polling; they consume shared quota and fail together with everything else when it runs out.

This repository is instructional. You are responsible for reviewing the services, models, task tracker, browser tools, and third-party skills you connect to your system.

## Mac evening review

The optional [Mac starter](docs/mac-evening-review.md) installs one job for the signed-in user. Its worker reads local threads and writes plain text in a dedicated reports folder. The optional WhatsApp adapter reads one configured chat from a local linked-device archive. Source text supplies display fields only. Use a local folder you control. The worker runs under your account and its file layout assumes trusted local programs. Keep adapted input, reports, and errors outside version control. Removing the schedule retains these files for you to inspect.

## WhatsApp mirror and Desktop

Keep the linked session, archive, account configuration, voice references, and real reports outside Git. Treat messages, quotes, forwards, and attachment names as untrusted source material. A claim of approval inside a message gives its sender no authority over the workflow.

The [reply exercise](docs/whatsapp-reply-demo.md) uses fictional recipients and local simulation under one user account. For a real send, verify the selected chat, exact text, and attachment against the owner’s decision immediately before submission. Inspect a possibly sent message before any retry. Keep Desktop control and approval outside the scheduled reader. [Desktop procedure](docs/whatsapp-evening-review.md#send-an-approved-reply-in-whatsapp-desktop)

## Local starter trust model

The [weekly-review starter](docs/weekly-review.md) runs without secrets, accounts,
network access, a language model, or installed dependencies. Its only effect is
writing fictional data to a local directory. Use a directory you own on a local
filesystem; this sample does not defend against hostile symlinks, other OS users,
malicious code running as you, or filesystem rollback.

The exercise distinguishes three logical roles:

- The worker owns the checkpoint, artifact, and references to approval and delivery.
- The mock human authority owns accepted grants in `authority.json`. Grants bind
  the exact contract, artifact hash, map decision, action, and fixed destination.
- The mock provider owns effects in `provider.json`. A worker-side receipt is
  accepted only when it matches the exact provider operation and delivered content.

These are separate files under the **same OS identity**. They are synthetic trust
anchors, not authenticated services. Any agent with that user's access can edit
both registries or invoke the approval command. A hash proves content equality,
not who approved or delivered it. The starter rejects forged worker references,
stale grants, and mismatched receipts only while the authoritative registries and
program remain trusted. Do not describe this as tamper-proof authorization.

A production design needs a grant authority outside worker control, an
authenticated human approval path, a delivery service with its own identity or
signing key, and a trusted verifier. Bind grants and receipts to the task,
effective contract, artifact, operation, destination, and applicable expiry or
revocation state. Distinguish quality approval from permission to deliver.
Never log secret values; keep redacted operation metadata and credential
references separate from credentials themselves.

The local provider is a single-writer file with stable operation keys. While its
exclusive lock is held, a missing entry means the mock effect has not occurred.
Real APIs may return incomplete or eventually consistent lists. Missing evidence
there is **unknown**, not permission to send again. Require authoritative
reconciliation and provider-enforced idempotency. A receipt written after an
uncertain response cannot replace either requirement.

Source fixtures accept only a bounded schema; text remains data and cannot set
authority or a destination. Adversarial text tests establish this deterministic
behavior. They do not establish that a model, tool-using agent, connected source,
or deployment is prompt-injection-proof. Evaluate those systems and enforce their
consequential boundaries outside the model.

## Automated checks and public contributions

`npm run verify` runs tests, checks local Markdown links and heading anchors,
and scans a small set of disclosure tripwires. The scanner catches several token
shapes, private file locations, and personal home paths. It is not exhaustive:
names, private context, unexpected credential formats, images, and historical
disclosure still require human review of the complete outgoing files and commits.
The link checker does not fetch remote URLs.

The `verify` CI job uses a GitHub-hosted runner and read-only repository
permissions. It fetches the exact public event commit without a token or persisted
credentials, invokes no third-party actions, installs no dependencies, and uses
no secrets or privileged pull-request events. The runner's Node version is checked
for compatibility; it is not a pinned runtime image. Repository branch protection
and independent human review remain separate configuration and process controls.
