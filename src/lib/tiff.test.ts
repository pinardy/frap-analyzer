import { describe, expect, it } from "vitest";
import {
  decodeTiffBuffer,
  displayWindowFor,
  frameStackRange,
} from "./tiff";

/** Build a minimal single-page uncompressed little-endian ("II") TIFF with
 * one grayscale sample of `bits` (8 or 16) per pixel, from raw sample values. */
function makeGrayTiff(
  width: number,
  height: number,
  samples: number[],
  bits: 8 | 16,
): ArrayBuffer {
  const bytesPerSample = bits / 8;
  const dataLen = width * height * bytesPerSample;
  const dataOffset = 8; // pixel strip sits right after the 8-byte header
  const ifdOffset = dataOffset + dataLen;
  const entries: [number, number, number, number][] = [
    [256, 4, 1, width], // ImageWidth (LONG)
    [257, 4, 1, height], // ImageLength (LONG)
    [258, 3, 1, bits], // BitsPerSample (SHORT)
    [259, 3, 1, 1], // Compression = none
    [262, 3, 1, 1], // PhotometricInterpretation = BlackIsZero
    [273, 4, 1, dataOffset], // StripOffsets (LONG)
    [277, 3, 1, 1], // SamplesPerPixel
    [278, 4, 1, height], // RowsPerStrip
    [279, 4, 1, dataLen], // StripByteCounts (LONG)
  ];
  const ifdLen = 2 + entries.length * 12 + 4;
  const buf = new ArrayBuffer(ifdOffset + ifdLen);
  const dv = new DataView(buf);

  dv.setUint16(0, 0x4949, true); // "II" little-endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOffset, true);

  for (let i = 0; i < samples.length; i++) {
    if (bits === 16) dv.setUint16(dataOffset + i * 2, samples[i], true);
    else dv.setUint8(dataOffset + i, samples[i]);
  }

  dv.setUint16(ifdOffset, entries.length, true);
  entries.forEach(([tag, type, count, value], i) => {
    const o = ifdOffset + 2 + i * 12;
    dv.setUint16(o, tag, true);
    dv.setUint16(o + 2, type, true);
    dv.setUint32(o + 4, count, true);
    // SHORT values occupy the low 2 bytes of the 4-byte value field.
    if (type === 3) dv.setUint16(o + 8, value, true);
    else dv.setUint32(o + 8, value, true);
  });
  dv.setUint32(ifdOffset + 2 + entries.length * 12, 0, true); // no next IFD

  return buf;
}

describe("decodeTiffBuffer", () => {
  it("preserves full 16-bit precision (no high-byte truncation)", () => {
    // Values that would collide if quantized to 8 bits (share a high byte).
    const samples = [0, 511, 512, 40000, 65535, 258];
    const buf = makeGrayTiff(3, 2, samples, 16);
    const { frames } = decodeTiffBuffer(buf, "test16.tif");

    expect(frames).toHaveLength(1);
    const frame = frames[0];
    expect(frame.data).toBeInstanceOf(Uint16Array);
    expect(frame.maxValue).toBe(65535);
    expect(Array.from(frame.data)).toEqual(samples);
  });

  it("decodes 8-bit grayscale to a Uint8Array with the native values", () => {
    const samples = [0, 17, 128, 200, 255, 42];
    const buf = makeGrayTiff(3, 2, samples, 8);
    const { frames } = decodeTiffBuffer(buf, "test8.tif");

    expect(frames[0].data).toBeInstanceOf(Uint8Array);
    expect(frames[0].maxValue).toBe(255);
    expect(Array.from(frames[0].data)).toEqual(samples);
  });
});

describe("display windowing", () => {
  it("keeps the full 0-255 window for 8-bit stacks", () => {
    const frame = {
      width: 2,
      height: 1,
      data: new Uint8Array([10, 200]),
      maxValue: 255,
    };
    expect(displayWindowFor([frame])).toEqual({
      min: 0,
      max: 255,
      ceiling: 255,
    });
  });

  it("auto-windows 16-bit stacks to the actual data range", () => {
    const frame = {
      width: 2,
      height: 1,
      data: new Uint16Array([1000, 4095]),
      maxValue: 65535,
    };
    expect(displayWindowFor([frame])).toEqual({
      min: 1000,
      max: 4095,
      ceiling: 65535,
    });
  });

  it("frameStackRange spans every frame", () => {
    const frames = [
      { width: 1, height: 1, data: new Uint16Array([500]), maxValue: 65535 },
      { width: 1, height: 1, data: new Uint16Array([9000]), maxValue: 65535 },
    ];
    expect(frameStackRange(frames)).toEqual({ min: 500, max: 9000 });
  });
});
