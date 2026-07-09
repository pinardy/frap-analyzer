# 🔬 FRAP Analyzer

A browser-based tool for FRAP (Fluorescence Recovery After Photobleaching)
analysis. It replaces the manual ImageJ workflow with a guided pipeline and runs
**entirely client-side** — your images never leave your machine.

## Pipeline

**1. Load & Concatenate → 2. Align → 3. Calibrate → 4. ROIs → 5. Bleach frame → 6. Analyze → Export**

1. **Load / Concatenate** — drop one or more 8-bit grayscale multi-page TIFF
   stacks. Multiple files are concatenated into one chronological stack
   (use *Sort by name* for natural order t1, t2, …, t10). Mirrors ImageJ
   *Image ▸ Stacks ▸ Concatenate*.
2. **Align** — translation-only registration by FFT phase correlation to remove
   slight sample drift between frames. This is the equivalent of the ImageJ
   **TurboReg** plugin in Translation mode (reimplemented, not the original Java
   plugin). Toggle raw/aligned to confirm the drift is gone. Align *before*
   placing ROIs.
3. **Calibrate** — draw a line over a feature of known length, enter its length
   in µm to get µm/pixel; enter the frame interval in seconds.
4. **ROIs** — draw three regions: **bleach** (circle, for the diffusion
   estimate), **background** (outside the cell), **reference** (an unbleached
   cell area, for acquisition-photobleaching correction).
5. **Bleach frame** — the first post-bleach frame (auto-detect available).
6. **Analyze** — full FRAP double-normalization, single-exponential fit, and
   results: **mobile/immobile fraction**, **half-time t½**, **R²**, and the
   **diffusion coefficient** (Soumpasis: D = 0.224·w²/t½).

**Export** — the per-frame CSV (raw / background-corrected / normalized values +
summary) from the table, and the recovery-curve plot as SVG or PNG.

## Try it without data

Click **Load demo dataset** — it synthesizes a stack with a known recovery,
acquisition photobleaching, and injected drift, then runs the whole pipeline so
you can see the fitted parameters recover the ground truth.

## Development

```bash
npm install
npm run dev      # start the app (Vite)
npm test         # run the unit + integration tests (Vitest)
npm run build    # type-check + production build
```

## How the analysis works

- **Measurements** always use the original pixel values; the brightness/contrast
  sliders only affect display.
- **Double normalization**, per frame *t*, with bleach/background/reference means
  `I_b, I_bg, I_r`:
  - `Ib = I_b − I_bg`, `Ir = I_r − I_bg`
  - averaged over pre-bleach frames → `Ib_pre`, `Ir_pre`
  - `Inorm(t) = (Ir_pre / Ir(t)) · (Ib(t) / Ib_pre)`
- **Fit**: `F(t') = F_inf − (F_inf − F0)·exp(−k·t')`; `t½ = ln2/k`;
  mobile fraction = `(F_inf − F0)/(1 − F0)`.

## Notes & limitations

- Primary target is 8-bit grayscale TIFF; other bit depths/RGB are decoded to
  8-bit grayscale for measurement.
- The diffusion coefficient assumes a uniform circular bleach (Soumpasis
  approximation); rectangular bleach ROIs use an area-equivalent radius and are
  flagged.
- Registration is translation-only (matching the requested TurboReg mode); it
  does not correct rotation or scaling.
