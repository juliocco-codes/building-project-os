# Schedule an evening review on a Mac

Every evening, your Mac can turn a list of threads into a short report you can read the next morning. You'll use two fictional threads to try the whole routine before adding a personal source. You need a Mac, a signed-in desktop session, and Node.js 20 or later with npm. [Download Node.js](https://nodejs.org/en/download)

## See what you'll get

Open Terminal and get a copy of the starter. If you already have a clone, open its folder in Terminal and skip these two commands.

```sh
git clone https://github.com/juliocco-codes/building-project-os.git
cd building-project-os
```

Check your Node version and preview a 7 pm review. You can substitute any time on your local 24-hour clock.

```sh
node --version
npm run evening -- preview 19:00
```

Preview reads [two sample threads](../examples/evening-threads.json) and prints the report. It makes no changes. Today's report will contain the following sections.

```text
Open (1)
- Trail map proof: Choose a legend for the two walking routes.

Closed (1)
- Workshop room: The community center confirmed the room.
```

## Give the Mac the schedule

Choose a time a few minutes from now if you want to see the first scheduled run today. Replace the example time in the install command before running it.

```sh
npm run evening -- install 19:00
npm run evening -- check
```

Install copies the worker and sample source to your user Library. It registers a LaunchAgent with macOS using the absolute path of the Node executable running the installer. It needs no administrator password. Check should say `Job is loaded.` A job waiting for its scheduled minute can have state `not running`.

To test the **clock**, leave your Mac awake and signed in, then close Terminal. Once your chosen minute has passed, open Terminal again in the repository and check the result.

```sh
npm run evening -- check
data="$HOME/Library/Application Support/Building Project OS/Evening Review"
cat "$data/reports/$(date +%F).txt"
```

Check reports the latest exit code when available. A successful run exits with 0. The dated file shows what the worker produced. You can also open the reports folder in Finder with **Go > Go to Folder** and paste `~/Library/Application Support/Building Project OS/Evening Review/reports`.

To test the **worker** immediately, run `npm run evening -- run`, then check again. This asks the registered job to start once. Both paths refresh the same file for the current local date. A reader sees a complete report, and invalid input leaves the last good report in place.

## What runs when the lid is closed?

macOS owns the clock through a per-user `launchd` job. Terminal, Codex, and Claude Code can all be closed. While you're signed in, a calendar trigger missed during sleep runs on wake. Several sleeping intervals can coalesce into one run. A powered-off Mac skips the slot. Logging out ends the user session, and the saved schedule loads again at login. The worker uses its actual run date and has no backfill for skipped days. [Apple's scheduling guide](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)

## Try your first real source

To add one WhatsApp chat to the evening report, start with the fictional preview and then configure your own linked device. [WhatsApp walkthrough](whatsapp-evening-review.md)

For a file source, start with a private copy of one local task list you already keep. For each item, set `status` to `open` or `closed`, give it a single-line `title`, and put the next decision or evidence of closure in a single-line `note`. Preview that file before installing it as the input. Replace the example path below with your copy's path.

```sh
source_file="$HOME/my-review-threads.json"
npm run evening -- preview 19:00 "$source_file"
```

After checking the preview, replace the starter's fictional input. Copy to a temporary file first so a scheduled read sees a complete snapshot.

```sh
data="$HOME/Library/Application Support/Building Project OS/Evening Review"
temp=$(mktemp "$data/threads.XXXXXXXX")
cp "$source_file" "$temp" && mv "$temp" "$data/threads.json" && npm run evening -- run
```

Read today's report again. With the file source alone, the worker reads `threads.json`. You control when to refresh that snapshot. Keep its scope limited to the selected list. Codex or Claude Code could optionally summarize that snapshot as a worker with separately configured model access. This example uses ordinary Node.js, runs offline, and sends nothing.

## Change the time or stop

```sh
npm run evening -- uninstall
npm run evening -- check
```

Uninstall unloads the job and removes its schedule. The second command should say `Job is unloaded.` The source, reports, installed worker and any error log stay in the data folder. To choose a new time, install again from the same checkout, for example `npm run evening -- install 18:15`. To discard the retained files, inspect the named folder in Finder and move that folder to Trash yourself.

## If a report is missing

- Run `check` from the repository and look for a loaded job and a last exit code. A failed install checks whether the job registered. If confirmed unloaded, it removes the attempted schedule. If registration is uncertain, it reports that the files were retained. Use `check`, then `uninstall` to clear a matching schedule before reinstalling from a signed-in desktop session.
- Open `errors.log` in the data folder if present. An invalid or unreadable source fails the run. Fix the input, preview it, then try `run` again. A prior report can survive a later failed run.
- If the job loads but never starts the worker, check `node -p process.execPath`. Use a stable Node installation outside Desktop, Documents, Downloads, or a removable disk. A background job can have different file access from Terminal. If a Node upgrade moved the executable, uninstall and reinstall with the new Node. The installed worker and input live under Application Support so the job can run with the repository closed or moved.
- The job label is `org.building-project-os.evening-review`. Its schedule lives under `~/Library/LaunchAgents`. A conflicting label, an existing schedule, or unrecognized data causes setup to stop. Inspect those files before changing them.
