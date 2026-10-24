import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { cleanCheckKeys, effectiveDisabled } from "./health-check-switches";

describe("health check switches", () => {
  it("ignores unknown keys so a typo can't silently disable something else", () => {
    assert.deepEqual(cleanCheckKeys(["readiness:norms_communication", "readiness:no_pm", 5]), ["readiness:norms_communication"]);
  });
  it("a check off for this run is off even when saved settings keep it on", () => {
    const off = effectiveDisabled([], ["readiness:norms_accountability"]);
    assert.equal(off.has("readiness:norms_accountability"), true);
    assert.equal(off.has("readiness:norms_communication"), false);
  });
  it("a saved switch stays off on every run", () => {
    assert.equal(effectiveDisabled(["gaps:norms_signatures"], undefined).has("gaps:norms_signatures"), true);
  });
});
