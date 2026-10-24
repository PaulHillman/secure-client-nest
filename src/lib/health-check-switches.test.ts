import { describe, expect, it } from "vitest";
import { cleanCheckKeys, effectiveDisabled } from "./health-check-switches";

describe("health check switches", () => {
  it("ignores unknown keys so a typo can't silently disable something else", () => {
    expect(cleanCheckKeys(["readiness:norms_communication", "readiness:no_pm", 5])).toEqual(["readiness:norms_communication"]);
  });
  it("a check off for this run is off even when saved settings keep it on", () => {
    const off = effectiveDisabled([], ["readiness:norms_accountability"]);
    expect(off.has("readiness:norms_accountability")).toBe(true);
    expect(off.has("readiness:norms_communication")).toBe(false);
  });
  it("a saved switch stays off on every run", () => {
    expect(effectiveDisabled(["gaps:norms_signatures"], undefined).has("gaps:norms_signatures")).toBe(true);
  });
});
