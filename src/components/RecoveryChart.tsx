import { useRef } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFrapStore } from "../store/useFrapStore";
import { downloadPng, downloadSvg } from "../lib/exportImage";

export default function RecoveryChart() {
  const measurements = useFrapStore((s) => s.measurements);
  const fit = useFrapStore((s) => s.fit);
  const bleachFrame = useFrapStore((s) => s.bleachFrame);
  const secondsPerFrame = useFrapStore((s) => s.calibration.secondsPerFrame);
  const wrapRef = useRef<HTMLDivElement>(null);

  const getSvg = () =>
    wrapRef.current?.querySelector("svg.recharts-surface") as
      | SVGSVGElement
      | undefined;

  if (!measurements) {
    return (
      <div className="chart-area">
        <div className="chart-head">
          <b>Recovery curve</b>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Run the analysis to plot the normalized recovery curve.
        </div>
      </div>
    );
  }

  const measData = measurements.map((m) => ({ time: m.time, value: m.normalized }));
  const fitData = fit?.curve ?? [];
  const bleachTime = bleachFrame * secondsPerFrame;

  return (
    <div className="chart-area">
      <div className="chart-head">
        <b>Recovery curve</b>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          normalized intensity vs time
        </span>
        <div className="spacer" />
        <button
          onClick={() => {
            const svg = getSvg();
            if (svg) downloadSvg(svg, "frap-recovery.svg");
          }}
        >
          SVG
        </button>
        <button
          onClick={() => {
            const svg = getSvg();
            if (svg) downloadPng(svg, "frap-recovery.png");
          }}
        >
          PNG
        </button>
      </div>
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="#2a3340" />
            <XAxis
              type="number"
              dataKey="time"
              domain={["dataMin", "dataMax"]}
              stroke="#9aa7b4"
              tick={{ fontSize: 11 }}
              label={{
                value: "time (s)",
                position: "insideBottom",
                offset: -10,
                fill: "#9aa7b4",
                fontSize: 12,
              }}
            />
            <YAxis
              stroke="#9aa7b4"
              tick={{ fontSize: 11 }}
              domain={[0, (max: number) => Math.max(1.1, max)]}
              label={{
                value: "normalized",
                angle: -90,
                position: "insideLeft",
                fill: "#9aa7b4",
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{ background: "#1f2630", border: "1px solid #2a3340" }}
              formatter={(v: number) => v.toFixed(4)}
              labelFormatter={(l: number) => `t = ${l.toFixed(2)} s`}
            />
            <ReferenceLine x={bleachTime} stroke="#ff5d5d" strokeDasharray="4 3" />
            <Scatter data={measData} dataKey="value" fill="#4aa3ff" />
            {fitData.length > 0 && (
              <Line
                data={fitData}
                dataKey="value"
                dot={false}
                stroke="#5dffa0"
                strokeWidth={2}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
