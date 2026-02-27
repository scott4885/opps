interface MetricCellProps {
  value: number;
  unit?: string | null;
  source?: string | null;
  filename?: string | null;
  uploadedAt?: Date | string | null;
}

function formatValue(value: number, unit?: string | null): string {
  if (unit === 'dollar') return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (unit === 'percent') return `${(value > 1 ? value : value * 100).toFixed(1)}%`;
  if (unit === 'count') return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === 'days') return `${value.toFixed(1)}d`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function MetricCell({ value, unit, source, filename, uploadedAt }: MetricCellProps) {
  const uploadedStr = uploadedAt
    ? new Date(uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="group relative inline-block">
      <span className="text-gray-900 tabular-nums cursor-help underline decoration-dotted decoration-gray-300">
        {formatValue(value, unit)}
      </span>
      {(source || filename) && (
        <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
            {source && <div className="font-medium mb-1">{source}</div>}
            {filename && <div className="text-gray-300 truncate">{filename}</div>}
            {uploadedStr && <div className="text-gray-400 mt-1">Uploaded {uploadedStr}</div>}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
