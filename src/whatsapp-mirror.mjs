import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

const day = 24 * 60 * 60 * 1000;
const freshness = 15 * 60 * 1000;
const limit = 50;
const ref = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const jid = value => typeof value === "string" && /^\d{1,24}@(s\.whatsapp\.net|lid)$/.test(value);
const pathValue = value => typeof value === "string" && isAbsolute(value) && !/[\p{C}]/u.test(value);
const instant = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value)
  ? Date.parse(value) : NaN;

class CoverageError extends Error {}

function requireEvidence(condition, reason = "Unexpected mirror response. Check the client version and store.") {
  if (!condition) throw new CoverageError(reason);
}

function data(envelope) {
  requireEvidence(envelope?.success === true && envelope.error === null && envelope.data);
  return envelope.data;
}

function collect(scope, now, doctor, chat, list) {
  requireEvidence(ref(scope.chatRef) && jid(scope.chatJid), "Choose one exact direct-chat JID and a short local chat reference.");
  const health = data(doctor());
  requireEvidence(health.authenticated === true && health.session_revoked === false && !health.store_error,
    "The local session or store is unavailable. Check pairing and sync.");
  const sync = instant(health.store?.last_sync_at);
  requireEvidence(Number.isFinite(sync) && sync <= now && now - sync <= freshness,
    "Successful archive sync is unknown, in the future, or older than 15 minutes. Refresh the mirror.");
  requireEvidence(data(chat()).jid === scope.chatJid, "Could not verify the exact chat in this store.");

  // v0.25.1 uses exclusive SQL boundaries and stores UTC seconds. Cover (start, sync].
  const start = sync - day;
  const after = new Date(start).toISOString();
  const before = new Date(sync + 1000).toISOString();
  const page = data(list(after, before));
  requireEvidence(page.source?.scope === "local_archive" && instant(page.source.last_sync_at) === sync,
    "Archive freshness changed or is unknown. Retry the bounded read.");
  requireEvidence(typeof page.page?.has_more === "boolean");
  requireEvidence(!page.page.has_more, "More than 50 messages matched. Coverage is incomplete.");
  requireEvidence(page.page.next_cursor === null);
  // Go serializes the nil slice for an empty result as JSON null in this release.
  const rows = page.messages === null ? [] : page.messages;
  requireEvidence(Array.isArray(rows) && rows.length <= limit);
  const ids = new Set();
  let previous = start;
  const messages = rows.map(row => {
    const time = instant(row?.Timestamp);
    requireEvidence(row?.ChatJID === scope.chatJid && ref(row.MsgID) && !ids.has(row.MsgID) &&
      time > start && time >= previous && time <= sync && typeof row.FromMe === "boolean" && typeof row.Text === "string",
      "An archive row could not be matched to this chat, window, or message schema.");
    requireEvidence(row.Revoked === false && row.DeletedForMe === false && !row.deleted_at && !row.payload_purged_at,
      "A deleted or unrecognized archive row was returned. Check the archive before retrying.");
    ids.add(row.MsgID);
    previous = time;
    const normalized = row.Text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/gu, " ").trim();
    const chars = Array.from(normalized);
    const body = chars.length > 240 ? chars.slice(0, 240).join("") + "…" : normalized;
    const directText = Boolean(body && chars.length <= 240 && row.IsForwarded === false && row.ForwardingScore === 0 &&
      row.Edited === false && row.MediaType === "" &&
      row.ReactionToID === "" && row.MediaCaption === "" && !row.quoted_msg_id && !row.quoted_sender_jid &&
      !row.Buttons?.length);
    return { messageRef: row.MsgID, timestamp: row.Timestamp, direction: row.FromMe ? "outgoing" : "incoming", body, directText };
  });
  return { coverage: "complete", chatRef: scope.chatRef, chatJid: scope.chatJid, after, through: new Date(sync).toISOString(), messages };
}

function readSource(mode, reader) {
  try {
    return { mode, ...reader() };
  } catch (error) {
    const reason = error instanceof CoverageError ? error.message : "Could not read the mirror input or run the client. Check local setup.";
    return { mode, coverage: "unavailable", reason, messages: [] };
  }
}

export function readMirrorFixture(path) {
  return readSource("fictional", () => {
    const fixture = JSON.parse(readFileSync(path, "utf8"));
    const now = instant(fixture.asOf);
    requireEvidence(fixture.mode === "fictional" && Number.isFinite(now), "The fictional fixture is invalid.");
    const result = collect(fixture, now, () => fixture.doctor, () => fixture.chat, () => fixture.list);
    const latest = result.messages.at(-1);
    if (latest?.directText && latest.direction === "incoming" && latest.messageRef === fixture.openRequestRef) {
      result.openRequestRef = latest.messageRef;
    }
    return result;
  });
}

function runClient(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL",
    maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  requireEvidence(!result.error && result.status === 0, "A local client read failed, timed out, or exceeded its output limit.");
  return result.stdout;
}

export function readMirrorConfig(path, now = new Date(), run = runClient) {
  return readSource("local archive", () => {
    const config = JSON.parse(readFileSync(path, "utf8"));
    requireEvidence(pathValue(config.binary) && pathValue(config.store), "Set absolute paths for the wacli binary and store.");
    requireEvidence(run(config.binary, ["--version"]).trim() === "wacli 0.25.1", "Use the supported wacli 0.25.1 release.");
    const query = args => JSON.parse(run(config.binary, ["--store", config.store, "--read-only", "--json", ...args]));
    return collect(config, now.getTime(),
      () => query(["doctor"]),
      () => query(["chats", "show", "--jid", config.chatJid]),
      (after, before) => query(["messages", "list", "--chat", config.chatJid, "--after", after, "--before", before, "--asc", "--limit", String(limit)]));
  });
}

export function renderMirror(result) {
  const lines = ["", "WhatsApp (" + result.mode + ")"];
  if (result.coverage !== "complete") return lines.concat("Coverage unavailable. " + result.reason).join("\n") + "\n";
  lines.push("Chat " + result.chatRef + " | Retained archive after " + result.after + " through " + result.through);
  if (result.messages.length === 0) lines.push("No retained messages in this chat and window.");
  for (const message of result.messages) {
    let label = message.direction === "incoming" ? "Review incoming message" : "Outgoing message";
    if (!message.directText) label = "Review original context";
    if (result.mode === "fictional" && result.openRequestRef === message.messageRef) label = "Open request (fictional case)";
    lines.push("- " + label + " | " + message.timestamp + " | " + message.direction + " | " + result.chatRef + "/" + message.messageRef +
      " | " + (message.body ? JSON.stringify(message.body) : "[no text]"));
  }
  return lines.join("\n") + "\n";
}
