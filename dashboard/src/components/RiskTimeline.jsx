import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  moderate: "#eab308",
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
      <p className="text-gray-300">{Math.floor(d.match_minute)}&apos; {String(Math.round((d.match_minute % 1) * 60)).padStart(2, "0")}&quot;</p>
      <p className="text-white font-semibold">Risk: {d.risk_score.toFixed(1)}</p>
    </div>
  );
}

export default function RiskTimeline({
  timeline,
  dangers,
  onDangerClick,
  windowStart,
  windowEnd,
  onChartClick,
}) {
  const handleClick = (e) => {
    if (!e || !e.activePayload) return;
    const point = e.activePayload[0].payload;
    onChartClick(point);
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-200">Defensive Risk Timeline</h2>
        <p className="text-xs text-gray-500">Click two points to select an analysis window</p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={timeline} onClick={handleClick} style={{ cursor: "crosshair" }}>
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
              <stop offset="40%" stopColor="#eab308" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="match_minute"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `${Math.round(v)}'`}
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="risk_score"
            fill="url(#riskGradient)"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />

          {/* Custom window selection highlight */}
          {windowStart && windowEnd && (
            <ReferenceArea
              x1={Math.min(windowStart.match_minute, windowEnd.match_minute)}
              x2={Math.max(windowStart.match_minute, windowEnd.match_minute)}
              fill="#004D98"
              fillOpacity={0.2}
              stroke="#004D98"
              strokeDasharray="4 4"
            />
          )}

          {/* First click marker */}
          {windowStart && !windowEnd && (
            <ReferenceLine
              x={windowStart.match_minute}
              stroke="#004D98"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}

          {/* Danger moment dots */}
          {dangers.map((d, i) => (
            <ReferenceDot
              key={i}
              x={d.display_peak_minute}
              y={d.peak_score}
              r={d.severity === "critical" ? 8 : d.severity === "high" ? 7 : 6}
              fill={SEVERITY_COLORS[d.severity]}
              stroke="white"
              strokeWidth={2}
              onClick={() => onDangerClick(d)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
