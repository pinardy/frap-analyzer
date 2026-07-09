import { describe, expect, it } from "vitest";
import type { FrameMeasurement } from "../types";
import { fitRecovery } from "./fit";

function measurement(
  frame: number,
  time: number,
  normalized: number,
): FrameMeasurement {
  return {
    frame,
    time,
    normalized,
    bleach: 0,
    background: 0,
    reference: 0,
    bleachCorr: 0,
    refCorr: 0,
  };
}

describe("fitRecovery", () => {
  it("recovers known parameters from a synthetic curve", () => {
    const f0 = 0.2;
    const fInf = 0.9;
    const k = 0.2;
    const bleachFrame = 5;
    const dt = 1;
    const ms: FrameMeasurement[] = [];
    for (let i = 0; i < bleachFrame; i++) ms.push(measurement(i, i * dt, 1));
    for (let i = 0; i < 45; i++) {
      const tp = i * dt;
      const v = fInf - (fInf - f0) * Math.exp(-k * tp);
      // small deterministic ripple
      const noise = 0.003 * Math.sin(i * 1.7);
      ms.push(measurement(bleachFrame + i, (bleachFrame + i) * dt, v + noise));
    }

    const fit = fitRecovery(ms, bleachFrame);
    expect(fit).not.toBeNull();
    expect(fit!.halfTime).toBeCloseTo(Math.log(2) / k, 0); // ~3.47 s
    // mobile fraction = (fInf - f0)/(1 - f0) = 0.7/0.8 = 0.875
    expect(fit!.mobileFraction).toBeCloseTo(0.875, 2);
    expect(fit!.rSquared).toBeGreaterThan(0.99);
  });

  it("returns null with too few post-bleach points", () => {
    const ms = [
      measurement(0, 0, 1),
      measurement(1, 1, 0.2),
      measurement(2, 2, 0.3),
    ];
    expect(fitRecovery(ms, 1)).toBeNull();
  });
});
