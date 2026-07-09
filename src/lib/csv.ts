import type {
  Calibration,
  DiffusionResult,
  FitResult,
  FrameMeasurement,
  FrameShift,
} from "../types";

export interface CsvInput {
  measurements: FrameMeasurement[];
  shifts?: FrameShift[];
  fit: FitResult | null;
  diffusion: DiffusionResult | null;
  calibration: Calibration;
  bleachFrame: number;
}

function num(v: number, digits = 4): string {
  if (!isFinite(v)) return "";
  return v.toFixed(digits);
}

export function buildCsv(input: CsvInput): string {
  const { measurements, shifts, fit, diffusion, calibration, bleachFrame } =
    input;
  const lines: string[] = [];

  lines.push("# FRAP analysis export");
  lines.push(
    `# pixels_per_um,${num(calibration.umPerPixel > 0 ? 1 / calibration.umPerPixel : 0, 6)}`,
  );
  lines.push(`# um_per_pixel,${num(calibration.umPerPixel, 6)}`);
  lines.push(`# seconds_per_frame,${num(calibration.secondsPerFrame, 4)}`);
  lines.push(`# bleach_frame,${bleachFrame}`);
  if (fit) {
    lines.push(`# half_time_s,${num(fit.halfTime)}`);
    lines.push(`# mobile_fraction,${num(fit.mobileFraction)}`);
    lines.push(`# immobile_fraction,${num(fit.immobileFraction)}`);
    lines.push(`# rate_k_per_s,${num(fit.k)}`);
    lines.push(`# r_squared,${num(fit.rSquared)}`);
  }
  if (diffusion) {
    lines.push(`# bleach_radius_um,${num(diffusion.radiusUm)}`);
    lines.push(`# diffusion_coeff_um2_per_s,${num(diffusion.D)}`);
    if (diffusion.fromRect)
      lines.push("# note,radius is area-equivalent from a rectangular ROI");
  }
  lines.push("");

  const header = [
    "frame",
    "time_s",
    "bleach_raw",
    "background_raw",
    "reference_raw",
    "bleach_bgcorr",
    "reference_bgcorr",
    "normalized",
  ];
  if (shifts) header.push("shift_dx", "shift_dy");
  lines.push(header.join(","));

  for (const m of measurements) {
    const row = [
      m.frame,
      num(m.time),
      num(m.bleach, 3),
      num(m.background, 3),
      num(m.reference, 3),
      num(m.bleachCorr, 3),
      num(m.refCorr, 3),
      num(m.normalized, 5),
    ];
    if (shifts) {
      const s = shifts[m.frame];
      row.push(s ? num(s.dx, 3) : "", s ? num(s.dy, 3) : "");
    }
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv",
) {
  const blob = new Blob([text], { type: mime });
  triggerDownload(filename, URL.createObjectURL(blob));
}

export function triggerDownload(filename: string, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
