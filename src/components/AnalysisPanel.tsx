import { useFrapStore } from "../store/useFrapStore";

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="result">
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export default function AnalysisPanel() {
  const runAnalysis = useFrapStore((s) => s.runAnalysis);
  const fit = useFrapStore((s) => s.fit);
  const diffusion = useFrapStore((s) => s.diffusion);
  const rois = useFrapStore((s) => s.rois);
  const umPerPixel = useFrapStore((s) => s.calibration.umPerPixel);

  const ready = rois.bleach && rois.background && rois.reference;

  return (
    <div className="panel">
      <h2>6 · Analyze</h2>
      <div className="btn-row">
        <button className="primary" disabled={!ready} onClick={runAnalysis}>
          Run analysis
        </button>
      </div>
      {!ready && (
        <small className="note">Place all three ROIs to enable analysis.</small>
      )}
      {fit && (
        <div className="results-grid" style={{ marginTop: 10 }}>
          <Result
            label="Mobile fraction"
            value={(fit.mobileFraction * 100).toFixed(1) + "%"}
          />
          <Result
            label="Immobile fraction"
            value={(fit.immobileFraction * 100).toFixed(1) + "%"}
          />
          <Result
            label="Half-time t½"
            value={isFinite(fit.halfTime) ? fit.halfTime.toFixed(2) + " s" : "—"}
          />
          <Result label="R²" value={fit.rSquared.toFixed(3)} />
          {diffusion ? (
            <>
              <Result
                label="Diffusion D"
                value={diffusion.D.toExponential(2) + " µm²/s"}
              />
              <Result
                label="Bleach radius"
                value={diffusion.radiusUm.toFixed(2) + " µm"}
              />
            </>
          ) : (
            <div className="result" style={{ gridColumn: "span 2" }}>
              <div className="lbl">
                {umPerPixel > 0
                  ? "Diffusion needs a valid fit."
                  : "Set spatial scale (µm/px) for the diffusion coefficient."}
              </div>
            </div>
          )}
        </div>
      )}
      {diffusion?.fromRect && (
        <small className="note">
          Diffusion uses an area-equivalent radius from a rectangular bleach ROI
          (approximate). Use a circular ROI for a standard estimate.
        </small>
      )}
      {fit && (
        <small className="note">
          D from Soumpasis: D = 0.224·w²/t½ (uniform circular bleach assumption).
        </small>
      )}
    </div>
  );
}
