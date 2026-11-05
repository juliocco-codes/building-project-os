# Refresh a linked-device archive before the evening review

The evening reader looks at **one chat** in an existing archive. The synchronizer connects the linked device and can store messages from multiple chats. Set up the paired store privately and try a foreground sync and read before scheduling it. If you already supervise a synchronizer for that store, use its freshness evidence and keep it as the only writer. [Mirror setup](whatsapp-mirror.md)

For a 7 pm review, the example below asks macOS to start a separate one-shot refresh at 6:55 pm while you are signed in. Change both times together. It syncs until idle, uses quiet presence, and leaves automatic media downloads off. The sample caps of 256 MB and 20,000 messages stop sync at the limit. Select caps suitable for your device. A sync can run long, fail, or miss its slot. The reader checks archive evidence each time and includes a coverage gap if the refresh was insufficient.

## Prepare and inspect

From the repo on your Mac, set the absolute paths to your verified client and the same store you paired in the mirror guide. Replace the example store path with yours. Prepare a private temporary copy of the template.

```sh
binary="$(command -v wacli)"
store="$HOME/path-to-your-paired-store"
draft_dir="$(mktemp -d)"
draft="$draft_dir/refresh.plist"
cp examples/whatsapp-sync.plist "$draft"
plutil -replace ProgramArguments.0 -string "$binary" "$draft"
plutil -replace ProgramArguments.2 -string "$store" "$draft"
plutil -lint "$draft"
plutil -p "$draft"
```

Check that both paths are absolute and the local time is correct. Edit the hour and minute using `plutil -replace StartCalendarInterval.Hour -integer 18 "$draft"` and the corresponding `StartCalendarInterval.Minute` command. Inspect the result again. Do this in a private Terminal.

## Register and verify

The commands below opt the signed-in account into one recurring refresh. The copy refuses to overwrite an existing job file. If this label already exists, inspect it before making any changes.

```sh
label=org.building-project-os.whatsapp-refresh
job="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"
(
  set -e
  test -x "$binary" && test -d "$store" || exit 1
  if launchctl print "$domain/$label" >/dev/null 2>&1; then
    echo "This label is already registered. Inspect the existing job." >&2
    exit 1
  fi
  mkdir -p "$HOME/Library/LaunchAgents"
  node -e 'const f=require("node:fs"); f.copyFileSync(process.argv[1],process.argv[2],f.constants.COPYFILE_EXCL)' "$draft" "$job"
  launchctl bootstrap "$domain" "$job"
  launchctl print "$domain/$label"
)
```

If bootstrap reports an error, inspect the registration and the job file immediately. A plist left in LaunchAgents can load at a future login. After the scheduled minute, inspect the job's exit status and the coverage time in your evening report. A loaded job by itself only shows registration. With a sleeping Mac, refresh and review can both become eligible on wake. If the review reported missing coverage, verify the sync first, then rerun the evening reader.

## Stop the refresh

Check the job's registered path with `launchctl print "$domain/$label"`. For the matching job, use `launchctl bootout "$domain" "$job"`. Once unloaded, move that specific plist out of LaunchAgents using Finder so it stays disabled at the next login. The archive and linked session are retained. You can separately remove the linked device from WhatsApp if you decide to end its access.
