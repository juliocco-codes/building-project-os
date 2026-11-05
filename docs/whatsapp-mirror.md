# Read one WhatsApp conversation in the evening review

The [offline walkthrough](whatsapp-evening-review.md) uses two invented conversations. Run either on a fresh clone with Node.js 20 or later. Each command reads one case and prints a report. It never starts wacli.

```sh
npm run evening -- preview 19:00 --mirror-fixture examples/whatsapp-mirror-parent.json
npm run evening -- preview 19:00 --mirror-fixture examples/whatsapp-mirror-bookkeeper.json
```

In the first report, look for `family-parent/parent-april-copy`. In the second, look for `studio-bookkeeper/bookkeeper-april-copy`. Each fixture has a fixed fictional clock and identifies one open request. Both use the same archive parser as the local reader. The task list still has its own open and closed sections.

## Optional setup for your own account

Use the Mac you control and a WhatsApp account you are authorized to link. **Pairing grants the linked device account access.** WhatsApp can mirror conversations beyond the one selected for this report. If that broader access is unsuitable, use the fictional inputs.

1. Install the macOS binary from the [wacli v0.25.1 release](https://github.com/openclaw/wacli/releases/tag/v0.25.1). Use its published checksum and a stable absolute executable path. The reader checks for `wacli 0.25.1`. If Homebrew installed a different version, use the pinned release for this walkthrough. [Upstream installation guide](https://github.com/openclaw/wacli/blob/v0.25.1/docs/install.md)
2. Create a private directory outside the repository and pair it yourself. The following path is a new store dedicated to the exercise. Run these commands only when you intend to link the device. On your phone, choose **Linked devices > Link a device**, then scan the QR shown in your own terminal. Keep the QR, session databases, and resulting archive on that Mac. The history flags request a smaller initial import. The phone determines what arrives. [Upstream pairing guide](https://github.com/openclaw/wacli/blob/v0.25.1/docs/auth.md)

   ```sh
   umask 077
   private_dir="$HOME/Library/Application Support/Evening Mirror"
   store="$private_dir/archive"
   mkdir -p "$store"
   bin=$(command -v wacli)
   "$bin" --version
   "$bin" --store "$store" auth --history-days 1 --history-max-per-chat 50
   ```

3. Refresh the archive before previewing or shortly before the scheduled review. Wait for the one-shot sync to finish successfully. Stop here if it fails. The timer only reads the archive. For a daily job, follow the [separate Mac sync schedule](whatsapp-sync-on-mac.md). Use one sync writer per store. If an existing follow process owns the store, keep its schedule or stop it deliberately before switching to scheduled one-shot sync. The reader requires a recorded successful sync within 15 minutes. A long-running follow process can have an older timestamp even while connected. A healthy connected one-shot records a new sync time even when no messages arrive. A fresh heartbeat or a recent message cannot replace that record. [Tagged upstream quiet-sync test](https://github.com/openclaw/wacli/blob/v0.25.1/internal/app/retrieval_cli_test.go#L466-L480). [Upstream sync guide](https://github.com/openclaw/wacli/blob/v0.25.1/docs/sync.md) and [doctor guide](https://github.com/openclaw/wacli/blob/v0.25.1/docs/doctor.md)

   ```sh
   "$bin" --store "$store" sync --once
   "$bin" --store "$store" --read-only --json doctor
   ```

4. Find one direct chat you recognize. A JID is WhatsApp's stored chat identifier. If you need to look it up, search the local chat directory by the person's exact display name. Inspect the returned matches privately and verify the intended person in WhatsApp. The starter accepts a numeric direct-chat JID ending in `@s.whatsapp.net` or `@lid`. It rejects groups, display names, and rows mapped to a different JID. [Upstream chats guide](https://github.com/openclaw/wacli/blob/v0.25.1/docs/chats.md)

   ```sh
   "$bin" --store "$store" --read-only --json chats list --query "REPLACE WITH DISPLAY NAME" --limit 5
   ```

5. Create `$private_dir/config.json` in a text editor. Replace all example values. Use the full paths printed by `printf '%s\n' "$bin" "$store"`. JSON paths must be literal absolute paths. Choose a short chat reference you will recognize in reports. Only you should be able to edit this configuration, since it selects the executable, store, and recipient evidence. Keep the configuration and daily reports out of Git.

   ```json
   {
     "binary": "/absolute/path/to/wacli",
     "store": "/absolute/path/to/your/archive",
     "chatJid": "REPLACE_WITH_YOUR_VERIFIED_DIRECT_CHAT_JID",
     "chatRef": "selected-chat"
   }
   ```

6. From the checkout, preview the real read. Inspect the chat reference, time window, message references, and excerpts in your terminal. You can also supply your existing task list after `19:00`, before the mirror option.

   ```sh
   chmod 600 "$private_dir/config.json"
   config="$private_dir/config.json"
   npm run evening -- preview 19:00 --mirror-config "$config"
   ```

7. To include this source on the Mac timer, use the following commands. If the starter already has a schedule, use its `uninstall` command first. Reinstall preserves recognized thread data and existing reports. For each scheduled run, the installed worker reloads the config and reads a new bounded window. Keep its paths accessible to your signed-in Mac user. The worker can run with Terminal closed. [Mac timer instructions](mac-evening-review.md)

   ```sh
   npm run evening -- install 19:00 --mirror-config "$config"
   npm run evening -- run
   npm run evening -- check
   data="$HOME/Library/Application Support/Building Project OS/Evening Review"
   cat "$data/reports/$(date +%F).txt"
   ```

The worker retains excerpts and source references in the daily report. To disconnect the reader, uninstall its schedule and optionally reinstall the task-list-only schedule. Revoke the linked device on your phone when you finish using the mirror. Review and remove retained config, archive, and reports separately as appropriate.

## What the coverage line establishes

Every actual run calls the pinned binary by absolute path with separate arguments. After checking its version, the reader fixes `--store`, `--read-only`, and `--json` and performs these three local operations:

| Command | Evidence used |
| --- | --- |
| `doctor` | Authenticated store, no observed revocation or store error, recorded successful sync within 15 minutes |
| `chats show --jid JID` | Exact chat exists in this store, even when the time window is empty |
| `messages list --chat JID --after START --before END --asc --limit 50` | One exact chat, last 24 hours through the successful sync, at most 50 messages |

The report shows the actual cutoff. It covers retained local rows after the start through the successful sync second. The API's bounds are exclusive, so the reader supplies the next second for `--before`. Events after the cutoff and history absent from the store are outside coverage. The adapter never contacts WhatsApp, starts sync, marks a message read, downloads an attachment, or sends a reply. A read-only archive cannot diagnose every later failed upstream sync. [Tagged read contract](https://github.com/openclaw/wacli/blob/v0.25.1/docs/messages.md#pagination-and-freshness)

A successful JSON envelope has `success: true`, `error: null`, and `data`. A list result carries `data.messages`, `data.page.has_more`, `data.page.next_cursor`, and `data.source`. The reader checks `scope: "local_archive"` and matches `last_sync_at` with doctor. For this release an empty Go slice may appear as `messages: null`. Missing fields, a changed sync time, an unexpected chat or row, a deleted row, and a continuation page produce **Coverage unavailable**. The reader declines a second page even if a cursor exists. Each subprocess has a five-second timeout and a 2 MiB output ceiling.

**No retained messages** means the bounded read completed with zero rows. **Coverage unavailable** keeps the other source sections visible, omits unverified WhatsApp rows, and gives the reader a reason. Check the client version, store access, successful sync time, and exact chat identity. A busy conversation exceeding the 50-message cap needs manual review. The timer never substitutes yesterday's WhatsApp section.

For each retained row the reader checks the chat, message ID, UTC timestamp, direction, and text. The report quotes single-line excerpts up to 240 characters and displays `[no text]` for a textless row. Forwarded, quoted, edited, clipped, or media rows call for reviewing their original context. A real incoming message stays an item to review until you verify its meaning and current status. Its contents cannot grant approval or supply commands to this reader.
