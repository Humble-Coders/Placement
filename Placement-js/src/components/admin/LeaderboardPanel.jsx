import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../firebase";
import {
  Trophy, Search, Download, GraduationCap, Loader2, AlertCircle,
  RefreshCw, Users, Clock, Activity,
} from "lucide-react";
import { cn } from "../ui/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const TOP_N_OPTIONS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, "ALL"];

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtMinutes(min) {
  if (!min || min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDateShort(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtDateFull(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isActiveToday(ts) {
  if (!ts) return false;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth()    === now.getUTCMonth()    &&
    d.getUTCDate()     === now.getUTCDate()
  );
}

function RankCell({ rank }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return (
    <span className="text-xs font-mono text-slate-400">{rank}</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaderboardPanel() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  // Controls
  const [topN, setTopN] = useState(50);
  const [branchFilter, setBranchFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch usage data and student profiles in parallel
      const [usageSnap, studentsSnap] = await Promise.all([
        getDocs(collection(db, "usage")),
        getDocs(collection(db, "students")),
      ]);

      // Build student profile lookup keyed by lowercase email
      const profileMap = {};
      studentsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.email) profileMap[data.email.toLowerCase()] = data;
      });

      // Merge usage record with student profile
      const merged = usageSnap.docs.map((d) => {
        const usage = d.data();
        const email = (usage.email ?? "").toLowerCase();
        const profile = profileMap[email] ?? {};
        return {
          uid:          d.id,
          email:        email || "—",
          name:         profile.name  ?? "",
          roll:         profile.roll  ?? "",
          branch:       usage.branch  ?? profile.branch ?? "",
          totalMinutes: usage.totalMinutes ?? 0,
          lastSeen:     usage.lastSeen ?? null,
        };
      });

      setAllData(merged);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // All unique branches for the filter dropdown
  const branches = useMemo(
    () => [...new Set(allData.map((s) => s.branch).filter(Boolean))].sort(),
    [allData]
  );

  // Pipeline: branch filter → sort by time → top-N cap → search filter
  const { rankedPool, displayedRows } = useMemo(() => {
    // 1. Apply branch filter
    const branchFiltered = branchFilter
      ? allData.filter((s) => s.branch === branchFilter)
      : allData;

    // 2. Sort descending by totalMinutes
    const sorted = [...branchFiltered].sort(
      (a, b) => b.totalMinutes - a.totalMinutes
    );

    // 3. Cap at Top N — rank is assigned at this point so it stays stable
    //    even when the search narrows the visible rows.
    const limited = topN === "ALL" ? sorted : sorted.slice(0, topN);
    const rankedPool = limited.map((s, i) => ({ ...s, rank: i + 1 }));

    // 4. Search filter — searches name, email, roll, branch simultaneously.
    //    Rank numbers are preserved from step 3 (not re-numbered after search).
    const q = searchQuery.trim().toLowerCase();
    const displayedRows = q
      ? rankedPool.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            s.roll.toLowerCase().includes(q) ||
            s.branch.toLowerCase().includes(q)
        )
      : rankedPool;

    return { rankedPool, displayedRows };
  }, [allData, branchFilter, topN, searchQuery]);

  // Summary KPIs from the ranked pool (pre-search, post branch+topN filter)
  const activeToday = rankedPool.filter((s) => isActiveToday(s.lastSeen)).length;
  const totalMinutesSum = rankedPool.reduce((a, s) => a + s.totalMinutes, 0);
  const avgMinutes = rankedPool.length > 0
    ? Math.round(totalMinutesSum / rankedPool.length)
    : 0;

  // Excel export — exports exactly the rows currently visible (respects all filters)
  const handleDownload = () => {
    const headers = [
      "Rank", "Name", "Roll No.", "Email", "Branch",
      "Total Active Time (min)", "Total Active Time", "Last Active",
    ];
    const rows = displayedRows.map((s) => [
      s.rank,
      s.name || s.email.split("@")[0],
      s.roll  || "—",
      s.email,
      s.branch || "—",
      s.totalMinutes,
      fmtMinutes(s.totalMinutes),
      fmtDateFull(s.lastSeen),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set reasonable column widths
    ws["!cols"] = [
      { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 32 },
      { wch: 10 }, { wch: 24 }, { wch: 18 }, { wch: 24 },
    ];

    // Bold the header row
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: col })];
      if (cell) cell.s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    const sheetName = (branchFilter ? `LB_${branchFilter}` : "Leaderboard").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const topLabel    = topN === "ALL" ? "all" : `top${topN}`;
    const branchLabel = branchFilter ? `_${branchFilter}` : "";
    const searchLabel = searchQuery.trim() ? `_search` : "";
    XLSX.writeFile(wb, `leaderboard_${topLabel}${branchLabel}${searchLabel}.xlsx`);
  };

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading leaderboard…</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertCircle className="h-5 w-5 text-red-400" />
      <p className="text-sm text-red-500">{error}</p>
      <button onClick={load} className="text-xs text-blue-600 hover:underline">Retry</button>
    </div>
  );

  if (allData.length === 0) return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="rounded-full bg-slate-100 p-4">
        <Trophy className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">No usage data yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Data will appear once students start using the portal.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Student Leaderboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked by total active time on the portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {fmtDateShort(lastRefresh)}
            </span>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Top N selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Show top</span>
          <select
            value={topN}
            onChange={(e) => {
              const v = e.target.value;
              setTopN(v === "ALL" ? "ALL" : Number(v));
            }}
            className="rounded-lg border border-slate-200 py-1.5 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {TOP_N_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === "ALL" ? "ALL" : n}
              </option>
            ))}
          </select>
        </div>

        {/* Branch filter */}
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-slate-200 py-1.5 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, roll, branch…"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={displayedRows.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Download className="h-3.5 w-3.5" />
          Download Excel
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 shrink-0">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">In View</p>
            <p className="text-xl font-bold text-blue-700">{rankedPool.length}</p>
            <p className="text-[10px] text-slate-400">
              {searchQuery ? `${displayedRows.length} matching search` : "students ranked"}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-green-50 p-2 shrink-0">
            <Clock className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Avg Time</p>
            <p className="text-xl font-bold text-green-700">{fmtMinutes(avgMinutes)}</p>
            <p className="text-[10px] text-slate-400">per student in view</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-violet-50 p-2 shrink-0">
            <Activity className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Active Today</p>
            <p className="text-xl font-bold text-violet-700">{activeToday}</p>
            <p className="text-[10px] text-slate-400">of {rankedPool.length} in view</p>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-semibold text-slate-600">
            {searchQuery
              ? `${displayedRows.length} result${displayedRows.length !== 1 ? "s" : ""} matching "${searchQuery}" · from top ${topN === "ALL" ? "ALL" : topN}${branchFilter ? ` in ${branchFilter}` : ""}`
              : `Top ${topN === "ALL" ? "ALL" : topN}${branchFilter ? ` · ${branchFilter}` : ""} · ${rankedPool.length} student${rankedPool.length !== 1 ? "s" : ""}`
            }
          </p>
          <p className="text-xs text-slate-400">
            Sorted by active time
          </p>
        </div>

        {displayedRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="rounded-full bg-slate-100 p-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">
              {searchQuery
                ? `No students match "${searchQuery}" in the current view.`
                : "No students found with the current filters."
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Roll No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayedRows.map((s) => {
                  const today = isActiveToday(s.lastSeen);
                  const isTop3 = s.rank <= 3;
                  return (
                    <tr
                      key={s.uid}
                      className={cn(
                        "transition",
                        isTop3
                          ? "bg-amber-50/40 hover:bg-amber-50"
                          : "hover:bg-slate-50"
                      )}
                    >
                      {/* Rank */}
                      <td className="px-4 py-3 text-center">
                        <RankCell rank={s.rank} />
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "font-medium",
                          isTop3 ? "text-amber-800" : "text-slate-800"
                        )}>
                          {s.name || <span className="text-slate-400 italic text-xs">No profile</span>}
                        </span>
                      </td>

                      {/* Roll */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {s.roll || <span className="text-slate-300">—</span>}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[220px] truncate">
                        {s.email}
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3">
                        {s.branch ? (
                          <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {s.branch}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Active Time */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "font-semibold tabular-nums",
                          isTop3 ? "text-amber-700" : "text-slate-800"
                        )}>
                          {fmtMinutes(s.totalMinutes)}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {today && (
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                          )}
                          <span className={cn(
                            "text-xs",
                            today ? "text-green-600 font-medium" : "text-slate-400"
                          )}>
                            {fmtDateShort(s.lastSeen)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 pb-1">
        Active time is measured while the portal tab is visible and focused. Idle time is excluded.
        {searchQuery && " · Rank numbers reflect position in the pre-search Top " + (topN === "ALL" ? "ALL" : topN) + " list."}
      </p>
    </div>
  );
}
