import { describe, expect, it } from "vitest";
import { makeDemoData } from "./demo";
import { registerStack } from "./register";
import { computeMeasurements } from "./frap";
import { fitRecovery } from "./fit";
import { diffusionCoefficient } from "./diffusion";

describe("end-to-end demo pipeline", () => {
  const demo = makeDemoData({ noise: 0.5 });

  it("registration recovers the injected drift (negated)", () => {
    const { shifts } = registerStack(demo.frames, {
      referenceFrame: 0,
      subpixel: true,
      autoCrop: false,
    });
    // applied shift should be approximately the negative of the drift
    for (let i = 1; i < demo.frames.length; i += 7) {
      expect(shifts[i].dx).toBeCloseTo(-demo.drift[i].dx, 0);
      expect(shifts[i].dy).toBeCloseTo(-demo.drift[i].dy, 0);
    }
  });

  it("full pipeline recovers the known mobile fraction and half-time", () => {
    const { aligned } = registerStack(demo.frames, {
      referenceFrame: 0,
      subpixel: true,
      autoCrop: false,
    });
    const measurements = computeMeasurements(
      aligned,
      {
        bleach: demo.bleachRoi,
        background: demo.backgroundRoi,
        reference: demo.referenceRoi,
      },
      demo.bleachFrame,
      demo.calibration.secondsPerFrame,
    );
    const fit = fitRecovery(measurements, demo.bleachFrame);
    expect(fit).not.toBeNull();
    expect(fit!.mobileFraction).toBeCloseTo(demo.truth.mobileFraction, 1);
    expect(fit!.halfTime).toBeGreaterThan(demo.truth.halfTime - 2);
    expect(fit!.halfTime).toBeLessThan(demo.truth.halfTime + 2);
    expect(fit!.rSquared).toBeGreaterThan(0.9);

    const d = diffusionCoefficient(
      demo.bleachRoi,
      demo.calibration.umPerPixel,
      fit!.halfTime,
    );
    expect(d).not.toBeNull();
    expect(d!.D).toBeGreaterThan(0);
  });
});
