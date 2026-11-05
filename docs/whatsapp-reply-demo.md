# Draft the same WhatsApp reply for two different people

Your parent asks for the April electricity statement. Your bookkeeper asks for a copy for the studio books. Both should get the same document. How would you reply to each of them?

This offline exercise uses fixed fictional writing samples and drafts. Node.js 20 or later runs it with no dependencies, account, or model. A simulated send saves the approved text and attachment in a local JSON file. You can read the [sample bill](../examples/april-electricity-bill.txt) before starting.

## Read the request and compare the drafts

From the repository root, create a fresh folder under `state/`, which Git ignores. If you completed the first three steps in the [evening review walkthrough](whatsapp-evening-review.md), keep using that folder and start with the bookkeeper draft.

```sh
mkdir -p state
node src/whatsapp-reply-cli.mjs init state/replies
node src/whatsapp-reply-cli.mjs draft state/replies parent examples/whatsapp-mirror-parent.json
node src/whatsapp-reply-cli.mjs draft state/replies bookkeeper examples/whatsapp-mirror-bookkeeper.json
```

Each draft reads the selected fictional mirror through the same reader as the evening review. It checks the chat identity, the exact direct incoming text, coverage, and whether a later message needs inspection. Forwarded, quoted, edited, and revoked messages require separate review. Each preview shows the request, the relationship cue, a previously approved **writing example**, the exact proposed reply, the bill contents and its fingerprint. The approval command represents a separate decision by the owner.

| Recipient | Proposed reply |
| --- | --- |
| Mom | Here you go, Mom! The April electricity bill is $48.00 and it's due May 10. |
| Studio bookkeeper | Attached is the April electricity bill from Paper Finch Energy for the studio books. Reference PF-APR, $48.00, due May 10. |

The statement establishes the amount, reference, and due date. Payment status would need separate evidence. To try drafting in your own voice, give your usual agent the [draft-personal-reply skill](../workspace/skills/draft-personal-reply/SKILL.md), your private voice guide, one approved example for the specific relationship, and the relevant document. Ask it to show the exact proposed reply for your review. You can use its wording in the edit command below. If you ask for a warmer greeting, the skill revises this draft. Ask explicitly if you want that preference kept for future replies. A contact's message cannot change your voice guide.

## Edit, approve, or cancel

Try a shorter family reply. Then preview the bookkeeper's draft again to see that it has its own wording and approval.

```sh
node src/whatsapp-reply-cli.mjs edit state/replies parent text "Here it is, Mom! Love you."
node src/whatsapp-reply-cli.mjs preview state/replies bookkeeper
```

To cancel the family draft, run the first command below. The second shows its state and an open request. You can restart that case with its original `draft` command.

```sh
node src/whatsapp-reply-cli.mjs cancel state/replies parent
node src/whatsapp-reply-cli.mjs status state/replies parent
```

For the bookkeeper, check the chat, text, attachment contents, and fingerprint. Copy the `previewId` from the preview you just read into the following command. This approval authorizes one local simulation of that exact reply.

```sh
node src/whatsapp-reply-cli.mjs approve state/replies bookkeeper PASTE_PREVIEW_ID --mock-send
node src/whatsapp-reply-cli.mjs send state/replies bookkeeper
node src/whatsapp-reply-cli.mjs status state/replies bookkeeper
```

The saved receipt should match the mock provider receipt. Repeating `send` returns the same receipt with `reconciled` set to true. The original request stays open. Actual receipt by a person, fulfillment of a request, and payment would each need their own evidence.

Every edit produces a new preview ID, even if you later restore the old wording. Try `edit state/replies parent attachment none` or `edit state/replies parent attachment bill` after restarting the parent case. This request requires the reviewed bill before approval. The `recipient` edit accepts an exact fixture chat ID. Changing it invalidates approval, and approval refuses any recipient outside the original conversation. Choose the separate case to reply to someone else.

## Recover a missing receipt

Restart the canceled parent draft, preview it, and copy its new ID. Use an approved case that has never run `send` for this exercise.

```sh
node src/whatsapp-reply-cli.mjs draft state/replies parent examples/whatsapp-mirror-parent.json
node src/whatsapp-reply-cli.mjs approve state/replies parent PASTE_NEW_PREVIEW_ID --mock-send
node src/whatsapp-reply-cli.mjs send state/replies parent --crash-after-provider
node src/whatsapp-reply-cli.mjs status state/replies parent
node src/whatsapp-reply-cli.mjs send state/replies parent
```

The interruption deliberately exits with an error after saving the mock effect. Status shows a provider receipt and an empty worker receipt. Retrying under the local lock finds that exact operation and saves its receipt. Check `state/replies/mock-provider.json` to see the two separate replies, one per chat. Use `--crash-before-provider` on a fresh approved case to try the earlier interruption. Retrying checks the intact provider slot under the lock. If that proves the attempt was unsent and the source or bill changed, the draft returns for review. A hard process termination may leave a lock. Follow the [lock recovery guide](operating-lessons.md#backup-and-restore) before removing it.

The simulator trusts its local files and runs approval and delivery under the same OS account. Anyone able to edit those files or invoke the CLI can change the simulation. In a connected deployment, keep approval under the user's control. If a real send has an uncertain outcome, inspect the actual chat and authoritative sending evidence. An empty or delayed mirror result cannot establish that a resend is safe. [Live desktop steps](whatsapp-evening-review.md#send-an-approved-reply-in-whatsapp-desktop)
