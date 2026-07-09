import { describe, expect, it } from "vitest";
import type { Frame } from "../types";
import { estimateShift, registerStack, shiftImage } from "./register";

/** Frame with a couple of bright disks so the correlation peak is sharp. */
function diskFrame(
  w: number,
  h: number,
  cx: number,
  cy: number,
): Frame {
  const data = new Uint8Array(w * h).fill(20);
  const blobs = [
    { x: cx, y: cy, r: 6, v: 220 },
    { x: cx + 14, y: cy - 10, r: 4, v: 160 },
  ];
  for (const b of blobs) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r) data[y * w + x] = b.v;
      }
    }
  }
  return { width: w, height: h, data };
}

describe("register", () => {
  it("recovers a known integer shift (correct sign)", () => {
    const ref = diskFrame(64, 64, 32, 32);
    const sx = 5;
    const sy = -3;
    const mov = diskFrame(64, 64, 32 + sx, 32 + sy); // content moved by (sx,sy)
    const { dx, dy } = estimateShift(ref, mov, false);
    // shift to apply to align mov onto ref is (-sx, -sy)
    expect(dx).toBeCloseTo(-sx, 0);
    expect(dy).toBeCloseTo(-sy, 0);
  });

  it("shiftImage(mov, est) reproduces the reference", () => {
    const ref = diskFrame(64, 64, 30, 34);
    const mov = diskFrame(64, 64, 34, 31);
    const { dx, dy } = estimateShift(ref, mov, false);
    const aligned = shiftImage(mov, Math.round(dx), Math.round(dy));
    let sad = 0;
    for (let i = 0; i < ref.data.length; i++)
      sad += Math.abs(ref.data[i] - aligned.data[i]);
    const meanAbsDiff = sad / ref.data.length;
    expect(meanAbsDiff).toBeLessThan(5);
  });

  it("registerStack leaves the reference frame untouched with zero shift", () => {
    const frames = [
      diskFrame(64, 64, 32, 32),
      diskFrame(64, 64, 35, 30),
      diskFrame(64, 64, 29, 33),
    ];
    const { aligned, shifts } = registerStack(frames, {
      referenceFrame: 0,
      subpixel: false,
      autoCrop: false,
    });
    expect(shifts[0]).toEqual({ dx: 0, dy: 0 });
    expect(aligned.length).toBe(3);
    // every aligned frame should resemble the reference
    for (const f of aligned) {
      let sad = 0;
      for (let i = 0; i < f.data.length; i++)
        sad += Math.abs(f.data[i] - frames[0].data[i]);
      expect(sad / f.data.length).toBeLessThan(6);
    }
  });

  it("shiftImage bilinear-interpolates fractional shifts", () => {
    const f: Frame = {
      width: 4,
      height: 1,
      data: new Uint8Array([0, 100, 0, 0]),
    };
    // shift content right by 0.5: output(x)=input(x-0.5)
    const out = shiftImage(f, 0.5, 0);
    // out[1] samples input at 0.5 -> avg(0,100)=50; out[2] at 1.5 -> avg(100,0)=50
    expect(out.data[1]).toBe(50);
    expect(out.data[2]).toBe(50);
  });
});
