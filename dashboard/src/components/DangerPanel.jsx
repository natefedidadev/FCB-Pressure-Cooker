function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SEVERITY_STYLES = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  moderate: "bg-yellow-500 text-gray-900",
};

export default function DangerPanel({ danger, onClose }) {
  if (!danger) return null;

  return (
    <div className="bg-surface rounded-2xl p-6 border border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.3)] overflow-y-auto flex-1">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`${SEVERITY_STYLES[danger.severity]} text-white text-sm px-3 py-1.5 rounded-full uppercase font-bold`}
          >
            {danger.severity}
          </span>
          {danger.resulted_in_goal && (
            <span className="bg-red-500/20 text-red-400 text-sm px-3 py-1.5 rounded-full font-bold border border-red-500/30">
              GOAL CONCEDED
            </span>
          )}
          <span className="text-muted text-base">
            Score: {danger.peak_score.toFixed(1)}/100
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-white text-2xl leading-none transition-colors"
        >
          &times;
        </button>
      </div>

      <p className="text-muted mt-4 text-base">
        Danger window: <span className="font-medium text-white">{fmtTime(danger.display_window_start)}</span>
        {" - "}
        <span className="font-medium text-white">{fmtTime(danger.display_window_end)}</span>
        {" "}(peak at {fmtTime(danger.display_peak_sec)})
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {danger.active_codes.map((code, i) => (
          <span
            key={i}
            className="bg-white/5 text-muted text-sm px-3 py-1.5 rounded-full border border-white/10"
          >
            {code}
          </span>
        ))}
      </div>

      <div className="mt-5 text-white/80 leading-relaxed whitespace-pre-wrap text-base">
        {danger.explanation}
      </div>

      {danger.nexus_timestamp && (
        <p className="mt-4 text-base text-barca-gold font-medium">
          Nexus timestamp: {danger.nexus_timestamp}
        </p>
      )}
    </div>
  );
}
