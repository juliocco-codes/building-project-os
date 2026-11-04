import test from "node:test";
import assert from "node:assert/strict";
import { disclosureFindings as scan } from "../scripts/check-disclosure.mjs";

test("disclosure tripwires reject sensitive paths and credential shapes", () => {
  assert.equal(scan("state/checkpoint.json", "{}").length, 1);
  assert.equal(scan(".env", "EXAMPLE=1").length, 1);
  assert.equal(scan("fixture.txt", ["/Users", "fictional", "private.txt"].join("/")).length, 1);
  assert.equal(scan("fixture.txt", "ghp_" + "x".repeat(30)).length, 1);
  assert.equal(scan("fixture.txt", "-----BEGIN " + "PRIVATE KEY-----").length, 1);
  assert.equal(scan("fixture.txt", "Bearer " + "a".repeat(30)).length, 1);
  assert.equal(scan("examples/fictional.json", '{"destination":"mock-editor-inbox"}').length, 0);
});
