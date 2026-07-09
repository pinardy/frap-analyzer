import { useFrapStore } from "../store/useFrapStore";
import { buildCsv, downloadText } from "../lib/csv";

export default function DataTable() {
  const measurements = useFrapStore((s) => s.measurements);
  const shifts = useFrapStore((s) => s.shifts);
  const fit = useFrapStore((s) => s.fit);
  const diffusion = useFrapStore((s) => s.diffusion);
  const calibration = useFrapStore((s) => s.calibration);
  const bleachFrame = useFrapStore((s) => s.bleachFrame);

  if (!measurements) {
    return (
      <div className="table-area">
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Per-frame measurements appear here after analysis.
        </div>
      </div>
    );
  }

  const exportCsv = () => {
    const csv = buildCsv({
      measurements,
      shifts: shifts ?? undefined,
      fit,
      diffusion,
      calibration,
      bleachFrame,
    });
    downloadText("frap-data.csv", csv);
  };

  return (
    <div className="table-area">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>Measurements</b>
        <div className="spacer" />
        <button onClick={exportCsv}>Export CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>t (s)</th>
            <th>bleach</th>
            <th>bg</th>
            <th>ref</th>
            <th>norm.</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((m) => (
            <tr key={m.frame} className={m.frame === bleachFrame ? "bleach-row" : ""}>
              <td>{m.frame}</td>
              <td>{m.time.toFixed(1)}</td>
              <td>{m.bleach.toFixed(1)}</td>
              <td>{m.background.toFixed(1)}</td>
              <td>{m.reference.toFixed(1)}</td>
              <td>{m.normalized.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
