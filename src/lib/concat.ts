import type { Frame, SourceFile } from "../types";

/** Natural-order comparison so file10 sorts after file2. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortSourcesByName(sources: SourceFile[]): SourceFile[] {
  return [...sources].sort((a, b) => naturalCompare(a.name, b.name));
}

/**
 * Concatenate ordered source files into one chronological frame stack.
 * All frames must share the same dimensions; otherwise throws (mirrors the
 * requirement that ImageJ Concatenate needs matching image sizes).
 */
export function concatSources(sources: SourceFile[]): Frame[] {
  const frames: Frame[] = sources.flatMap((s) => s.frames);
  if (frames.length === 0) return frames;
  const { width, height } = frames[0];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].width !== width || frames[i].height !== height) {
      throw new Error(
        `Frame ${i} is ${frames[i].width}x${frames[i].height}, expected ${width}x${height}. All images must have the same dimensions to concatenate.`,
      );
    }
  }
  return frames;
}
