function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SEVERITY_COLORS = {
  critical: "border-red-500 bg-red-500/10",
  high: "border-orange-500 bg-orange-500/10",
  moderate: "border-yellow-500 bg-yellow-500/10",
};

const SEVERITY_DOT = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  moderate: "bg-yellow-500",
};

export default function DangerList({ dangers, selectedDanger, onSelect }) {
  if (!dangers || dangers.length === 0) return null;

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Danger Moments ({dangers.length})
      </h3>
      <div className="space-y-2">
        {dangers.map((d, i) => {
          const isSelected = selectedDanger && selectedDanger.peak_time === d.peak_time;
          return (
            <button
              key={i}
              onClick={() => onSelect(d)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors
                ${isSelected ? "border-barca-blue bg-barca-blue/10" : SEVERITY_COLORS[d.severity]}
                hover:bg-gray-700/50`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[d.severity]}`} />
                <span className="text-white text-sm font-medium">
                  {fmtTime(d.display_peak_sec)}
                </span>
                <span className="text-gray-400 text-xs uppercase">{d.severity}</span>
                {d.resulted_in_goal && (
                  <span className="text-red-400 text-xs font-bold ml-auto">GOAL</span>
                )}
                {!d.resulted_in_goal && (
                  <span className="text-gray-500 text-xs ml-auto">{d.peak_score.toFixed(0)}/100</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
