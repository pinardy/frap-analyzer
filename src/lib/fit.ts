import { levenbergMarquardt } from "ml-levenberg-marquardt";
import type { FitResult, FrameMeasurement } from "../types";

/** Recovery model: F(t') = fInf - (fInf - f0) * exp(-k * t'), t' >= 0. */
function model([f0, fInf, k]: number[]) {
  return (t: number) => fInf - (fInf - f0) * Math.exp(-k * t);
}

/**
 * Fit a single-exponential recovery to the post-bleach normalized data.
 * Returns null if there are too few points to fit.
 */
export function fitRecovery(
  measurements: FrameMeasurement[],
  bleachFrame: number,
): FitResult | null {
  const post = measurements.filter((m) => m.frame >= bleachFrame);
  if (post.length < 4) return null;

  const t0 = post[0].time;
  const x = post.map((m) => m.time - t0);
  const y = post.map((m) => m.normalized);

  // Initial guesses.
  const f0Guess = y[0];
  const tail = y.slice(Math.max(0, y.length - Math.ceil(y.length / 4)));
  const fInfGuess = tail.reduce((a, b) => a + b, 0) / tail.length;
  const duration = x[x.length - 1] || 1;
  // rough half-time: first crossing of the midpoint.
  const mid = (f0Guess + fInfGuess) / 2;
  let tHalfGuess = duration / 3;
  for (let i = 0; i < y.length; i++) {
    if (y[i] >= mid) {
      tHalfGuess = Math.max(x[i], duration / 20);
      break;
    }
  }
  const kGuess = Math.log(2) / tHalfGuess;

  let result;
  try {
    result = levenbergMarquardt(
      { x, y },
      model,
      {
        initialValues: [f0Guess, fInfGuess, kGuess],
        minValues: [-1, 0, 1e-6],
        maxValues: [2, 2, 1e3],
        maxIterations: 300,
        damping: 1e-2,
        gradientDifference: 1e-4,
      },
    );
  } catch {
    return null;
  }

  const [f0, fInf, k] = result.parameterValues;
  const f = model([f0, fInf, k]);

  // R^2 against the data.
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < x.length; i++) {
    const resid = y[i] - f(x[i]);
    ssRes += resid * resid;
    ssTot += (y[i] - yMean) * (y[i] - yMean);
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const halfTime = k > 0 ? Math.log(2) / k : Infinity;
  const rawMobile = (fInf - f0) / (1 - f0);
  const mobileFraction = Math.min(1, Math.max(0, rawMobile));

  const curve: { time: number; value: number }[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const tt = (duration * i) / steps;
    curve.push({ time: t0 + tt, value: f(tt) });
  }

  return {
    f0,
    fInf,
    k,
    halfTime,
    mobileFraction,
    immobileFraction: 1 - mobileFraction,
    rSquared,
    curve,
  };
}
