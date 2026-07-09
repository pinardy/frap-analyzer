import { describe, expect, it } from "vitest";
import type { Frame, SourceFile } from "../types";
import { concatSources, naturalCompare, sortSourcesByName } from "./concat";

function frame(w: number, h: number, fill = 0): Frame {
  return { width: w, height: h, data: new Uint8Array(w * h).fill(fill) };
}

function source(name: string, count: number, w = 8, h = 8): SourceFile {
  return { name, frames: Array.from({ length: count }, () => frame(w, h)) };
}

describe("concat", () => {
  it("preserves order and total page count", () => {
    const out = concatSources([source("a", 2), source("b", 3)]);
    expect(out.length).toBe(5);
  });

  it("rejects mismatched dimensions", () => {
    const bad: SourceFile = { name: "bad", frames: [frame(8, 8), frame(16, 8)] };
    expect(() => concatSources([bad])).toThrow(/dimensions/);
  });

  it("natural-sorts filenames numerically", () => {
    const sorted = sortSourcesByName([
      source("t10", 1),
      source("t2", 1),
      source("t1", 1),
    ]).map((s) => s.name);
    expect(sorted).toEqual(["t1", "t2", "t10"]);
    expect(naturalCompare("t2", "t10")).toBeLessThan(0);
  });
});
