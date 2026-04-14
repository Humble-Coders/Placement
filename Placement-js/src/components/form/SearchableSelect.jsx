import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { cn } from "../ui/utils";

/**
 * Accessible searchable single-select dropdown.
 *
 * Props:
 *  options    – [{ id, name }]
 *  value      – currently selected id (or "")
 *  onChange   – (id, option) => void
 *  placeholder – string
 *  disabled   – bool
 *  error      – bool (red border)
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = query.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleSelect = (opt) => {
    onChange(opt.id, opt);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("", null);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-sm text-left transition",
          "outline-none focus:ring-2 focus:ring-blue-100",
          error
            ? "border-red-300 focus:border-red-400"
            : "border-slate-200 focus:border-blue-400",
          open && "border-blue-400 ring-2 ring-blue-100",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50"
        )}
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>
          {selected ? selected.name : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onMouseDown={handleClear}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="flex-1 text-sm outline-none placeholder-slate-400 text-slate-800"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-slate-400">
                No results for &ldquo;{query}&rdquo;
              </li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm text-left transition hover:bg-blue-50",
                      opt.id === value
                        ? "text-blue-700 bg-blue-50/70 font-medium"
                        : "text-slate-700"
                    )}
                  >
                    {opt.name}
                    {opt.id === value && <Check className="h-3.5 w-3.5 text-blue-500" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
