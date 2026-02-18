function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SEVERITY_STYLES = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  moderate: "bg-yellow-500 text-gray-900",
};

export default function DangerPanel({ danger, onClose }) {
  if (!danger) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mt-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span
            className={`${SEVERITY_STYLES[danger.severity]} text-white text-xs px-2 py-1 rounded uppercase font-bold`}
          >
            {danger.severity}
          </span>
          {danger.resulted_in_goal && (
            <span className="bg-red-900 text-red-200 text-xs px-2 py-1 rounded font-bold">
              GOAL CONCEDED
            </span>
          )}
          <span className="text-gray-400 text-sm">
            Score: {danger.peak_score.toFixed(1)}/100
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <p className="text-gray-300 mt-3 text-sm">
        Danger window: <span className="text-white font-medium">{fmtTime(danger.display_window_start)}</span>
        {" - "}
        <span className="text-white font-medium">{fmtTime(danger.display_window_end)}</span>
        {" "}(peak at {fmtTime(danger.display_peak_sec)})
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        {danger.active_codes.map((code, i) => (
          <span
            key={i}
            className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded"
          >
            {code}
          </span>
        ))}
      </div>

      <div className="mt-4 text-gray-100 leading-relaxed whitespace-pre-wrap text-sm">
        {danger.explanation}
      </div>

      {danger.nexus_timestamp && (
        <p className="mt-3 text-sm text-barca-gold">
          Nexus timestamp: {danger.nexus_timestamp}
        </p>
      )}
    </div>
  );
}
