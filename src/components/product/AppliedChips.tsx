export default function AppliedChips({
  chips,
  onRemove,
  onClear,
}: {
  chips: { key: string; label: string }[]
  onRemove: (key: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <span className="text-sm text-gray-600">Ви шукали:</span>
      {chips.map((ch) => (
        <button
          key={ch.key}
          onClick={() => onRemove(ch.key)}
          className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50 flex items-center gap-2"
        >
          {ch.label}
          <span className="text-gray-400">×</span>
        </button>
      ))}
      <button
        onClick={onClear}
        className="ml-2 text-sm underline text-gray-600 hover:text-black"
      >
        Видалити все
      </button>
    </div>
  )
}
