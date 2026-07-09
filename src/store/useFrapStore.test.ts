import { describe, expect, it, beforeEach } from "vitest";
import { useFrapStore } from "./useFrapStore";

describe("useFrapStore integration", () => {
  beforeEach(() => useFrapStore.getState().reset());

  it("loadDemo runs the full pipeline the UI triggers", () => {
    useFrapStore.getState().loadDemo();
    const s = useFrapStore.getState();
    expect(s.frames.length).toBeGreaterThan(0);
    expect(s.aligned).not.toBeNull();
    expect(s.shifts).not.toBeNull();
    expect(s.measurements).not.toBeNull();
    expect(s.fit).not.toBeNull();
    expect(s.fit!.mobileFraction).toBeCloseTo(0.7, 1);
    expect(s.diffusion).not.toBeNull();
    expect(s.diffusion!.D).toBeGreaterThan(0);
  });

  it("blocks analysis until all three ROIs are set", () => {
    useFrapStore.getState().loadDemo();
    useFrapStore.getState().clearRoi("reference");
    useFrapStore.getState().runAnalysis();
    expect(useFrapStore.getState().status).toMatch(/three ROIs/);
  });

  it("derives um/pixel from a scale line", () => {
    useFrapStore
      .getState()
      .setScaleLine({ x1: 0, y1: 0, x2: 50, y2: 0 }, 5);
    expect(useFrapStore.getState().calibration.umPerPixel).toBeCloseTo(0.1, 6);
  });

  it("undo removes the drawn scale line", () => {
    useFrapStore.getState().setScaleLine({ x1: 0, y1: 0, x2: 50, y2: 0 }, 5);
    expect(useFrapStore.getState().calibration.scaleLine).toBeDefined();
    useFrapStore.getState().clearScaleLine();
    expect(useFrapStore.getState().calibration.scaleLine).toBeUndefined();
  });

  it("allows setting the scale directly by value", () => {
    useFrapStore.getState().setCalibration({ umPerPixel: 0.25 });
    expect(useFrapStore.getState().calibration.umPerPixel).toBe(0.25);
  });
});
