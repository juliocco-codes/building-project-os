# Security and privacy

A personal task system can reveal relationships, routines, locations, finances, health information, travel, and account activity even when it contains no password. Treat the real workspace and task history as private by default.

Before committing any change:

- search for names, email addresses, phone numbers, addresses, calendar titles, travel details, issue identifiers, and local filesystem paths;
- search for API keys, OAuth tokens, cookies, bearer tokens, private keys, webhook URLs, and approval endpoints;
- inspect screenshots and example output for personal or commercially sensitive information;
- inspect the complete Git diff and repository history;
- never commit a real `.env`, task export, personal wiki, memory directory, browser profile, credential file, or dispatcher state database.

If a secret enters Git history, deleting it in a later commit is not enough. Revoke it immediately and clean the repository history before publishing.

## Authority boundaries

- Begin read-only and add one narrow write capability at a time.
- Treat sending messages, booking, purchasing, deleting, publishing, and changing permissions as separate authorities.
- Do not infer authority from the desired outcome.
- Require an explicit review handoff for identity checks, credentials, financial commitments, legal acceptance, or destructive actions.
- Make every automated run traceable to one stable task and revision.
- Never approve an agent's own request automatically.

This repository is instructional. You are responsible for reviewing the services, models, task tracker, browser tools, and third-party skills you connect to your system.
