# From a WhatsApp request to an approved reply

A parent asks for a copy of the April electricity bill. At review time you want to see the open request, check a draft that sounds like you, and choose whether to send the document. A bookkeeper might ask for the very same bill. The facts stay the same while the relationship changes the wording.

## Try the fictional case

From a clone of this repository with Node.js 20 or later, preview the evening review and open a reply for the same request.

```sh
npm run evening -- preview 19:00 --mirror-fixture examples/whatsapp-mirror-parent.json
mkdir -p state
node src/whatsapp-reply-cli.mjs init state/replies
node src/whatsapp-reply-cli.mjs draft state/replies parent examples/whatsapp-mirror-parent.json
```

Find the WhatsApp thread alongside the other evening items. The draft command takes the same evidence that supplied the review. Follow the [reply exercise](whatsapp-reply-demo.md) to inspect the bill, edit or cancel the draft, or approve one simulated send. The bookkeeper example uses a separate conversation and approval.

The parent’s preview starts “Here you go, Mom!” The bookkeeper’s preview leads with the attached bill and includes its filing reference. Both use the same sample bill. Neither case establishes that the bill was paid. In the offline demo these are retained example drafts. To generate your own, give your agent the skill and your private version of the [voice guide](../workspace/VOICE.example.md).

The [draft-personal-reply skill](../workspace/skills/draft-personal-reply/SKILL.md) shows an agent how to combine a verified document, the conversation so far, and the owner’s approved writing preferences. When building your own version, supply a relevant, privately kept family or professional writing example. Review whether the draft continues the conversation naturally and whether every fact and commitment is supported by the document or the owner.

## Use one of your own chats

The Mac owns the review time. A separate synchronizer maintains your linked-device archive. At review time the reader checks coverage and queries one chosen chat for a bounded window. A quiet chat and an unavailable source have different meanings in the report. Try the [read-only mirror setup](whatsapp-mirror.md) with the [Mac scheduling guide](mac-evening-review.md). Keep the session, contacts, threads, attachments, and writing samples in your private workspace.

Verify who actually asked for the document. A person quoted in a forwarded message may be someone other than the sender. Resolve ambiguous identities and requests with the owner before drafting. Keep the request open until the agreed evidence of completion exists.

## Send an approved reply in WhatsApp Desktop

These steps are for a human operator or a separately authorized desktop worker on the owner's signed-in Mac. The offline exercise records a simulated send in a local file.

1. **Review the proposed send.** Show the owner the intended chat, final text, and a preview of the attachment with its filename. Bind approval to the chat identity, text and file contents. Present a revised preview for approval after any change.
2. **Verify the destination.** Open the intended conversation in WhatsApp Desktop. Check the chat header and a trusted identifying detail. Two contacts can share a display name. Resolve uncertainty with the owner before proceeding.
3. **Check the composer.** Match the text and attachment in the app to the approved version. Inspect the billing month and check that the file still matches the approved bytes. If the app would separate the caption and document into different sends, confirm the intended delivery with the owner.
4. **Submit once and inspect the result.** Verify that the expected text and document appear as outgoing in the correct chat. If submission might have succeeded, retain the attempt and inspect the conversation before taking another action. A healthy mirror can corroborate the result. A delayed update alone cannot justify a resend. Record what you observed and distinguish submission from the recipient acknowledging receipt.

You can use the reader solely for triage or stop at a draft. Desktop access becomes relevant when the owner chooses a real send.
