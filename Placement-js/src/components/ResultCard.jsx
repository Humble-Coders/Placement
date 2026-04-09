import { ChevronRight, Tag } from "lucide-react";

export default function ResultCard({ title, subtitle, meta, tags, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md animate-fade-in"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {subtitle && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
              <Tag className="h-3 w-3 shrink-0" />
              <span className="truncate">{subtitle}</span>
            </div>
          )}
          <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors leading-snug">
            {title}
          </h3>
          {meta && meta.length > 0 && (
            <div className="mt-2 flex items-center gap-3">
              {meta.map((m, i) => (
                <span key={i} className="flex items-center gap-1 text-xs text-slate-400">
                  {m.icon && <span className="text-slate-400">{m.icon}</span>}
                  {m.label}
                </span>
              ))}
            </div>
          )}
          {tags && tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.slice(0, 4).map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600"
                >
                  {t}
                </span>
              ))}
              {tags.length > 4 && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-400">
                  +{tags.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors" />
      </div>
    </button>
  );
}
