import test from "node:test";
import assert from "node:assert/strict";
import { permissionTier } from "../src/project-os.mjs";

test("work from the user's own inputs runs in the trusted tier", () => {
  const tier = permissionTier([{ origin: "user" }, { origin: "repository" }]);
  assert.deepEqual(tier, { tier: "trusted", credentials: true, writes: "contract", sandbox: false });
});

test("any third-party input moves the agent to the restricted tier", () => {
  const tier = permissionTier([{ origin: "user" }, { origin: "email" }, { origin: "web" }]);
  assert.equal(tier.tier, "restricted");
  assert.equal(tier.credentials, false);
  assert.equal(tier.writes, "proposals_only");
  assert.deepEqual(tier.because, ["email", "web"]);
});
