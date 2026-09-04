# Security and privacy

A personal task system can reveal relationships, routines, locations, finances, health information, travel, and account activity even when it contains no password. Treat the real workspace and task history as private by default.

Before committing any change:

- search for names, email addresses, phone numbers, addresses, calendar titles, travel details, issue identifiers, and local filesystem paths;
- search for API keys, OAuth tokens, cookies, bearer tokens, private keys, webhook URLs, and approval endpoints;
- inspect screenshots and example output for personal or commercially sensitive information;
- inspect the complete Git diff and repository history;
- never commit a real `.env`, task export, personal wiki, memory directory, browser profile, credential file, or dispatcher state database.
- keep examples fictional and vendor-neutral: no production issue IDs, fingerprints, task or turn IDs, channel identifiers, endpoints, usernames, schedules, logs, or local paths;
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

This repository is instructional. You are responsible for reviewing the services, models, task tracker, browser tools, and third-party skills you connect to your system.
