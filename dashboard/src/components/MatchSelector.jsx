export default function MatchSelector({ matches, selected, onSelect, loading }) {
  return (
    <select
      value={selected ?? ""}
      onChange={(e) => onSelect(Number(e.target.value))}
      disabled={loading}
      className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 text-sm
                 focus:outline-none focus:border-barca-blue disabled:opacity-50 w-full max-w-xl"
    >
      <option value="" disabled>
        Select a match...
      </option>
      {matches.map((m) => (
        <option key={m.index} value={m.index}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
