import { useFrapStore } from "../store/useFrapStore";

export default function AlignPanel() {
  const frames = useFrapStore((s) => s.frames);
  const aligned = useFrapStore((s) => s.aligned);
  const shifts = useFrapStore((s) => s.shifts);
  const opts = useFrapStore((s) => s.alignOptions);
  const setOpts = useFrapStore((s) => s.setAlignOptions);
  const runAlign = useFrapStore((s) => s.runAlign);
  const showRaw = useFrapStore((s) => s.showRaw);
  const setShowRaw = useFrapStore((s) => s.setShowRaw);

  const disabled = frames.length === 0;

  return (
    <div className="panel">
      <h2>2 · Align (drift correction)</h2>
      <small className="note">
        Translation-only registration by FFT phase correlation — the equivalent
        of ImageJ TurboReg in Translation mode. Align before placing ROIs.
      </small>
      <div className="row" style={{ marginTop: 8 }}>
        <label>Reference frame</label>
        <input
          type="number"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={opts.referenceFrame}
          onChange={(e) =>
            setOpts({ referenceFrame: Number(e.target.value) || 0 })
          }
        />
      </div>
      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={opts.subpixel}
            onChange={(e) => setOpts({ subpixel: e.target.checked })}
          />{" "}
          Subpixel (bilinear)
        </label>
      </div>
      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={opts.autoCrop}
            onChange={(e) => setOpts({ autoCrop: e.target.checked })}
          />{" "}
          Auto-crop to valid region
        </label>
      </div>
      <div className="btn-row">
        <button className="primary" disabled={disabled} onClick={runAlign}>
          Run alignment
        </button>
        {aligned && (
          <button
            className={showRaw ? "active" : ""}
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? "Viewing: raw" : "Viewing: aligned"}
          </button>
        )}
      </div>

      {shifts && (
        <>
          <div className="drift" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>frame</th>
                  <th>dx (px)</th>
                  <th>dy (px)</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => (
                  <tr key={i}>
                    <td>{i}</td>
                    <td>{s.dx.toFixed(2)}</td>
                    <td>{s.dy.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="note">
            Toggle raw/aligned above to confirm drift is removed.
          </small>
        </>
      )}
    </div>
  );
}
