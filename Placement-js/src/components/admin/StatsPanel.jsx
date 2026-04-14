import { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import {
  Users, Clock, TrendingUp, Activity, RefreshCw,
  Loader2, AlertCircle, ChevronDown, ChevronUp, GraduationCap,
} from "lucide-react";
import { cn } from "../ui/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#84cc16", "#6366f1", "#0ea5e9", "#d946ef",
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtMinutes(min) {
  if (!min || min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)   return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function getLast30Days() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

function formatDayLabel(isoDate) {
  // "YYYY-MM-DD" → "Apr 26"
  const [, mm, dd] = isoDate.split("-");
  return `${MONTHS[parseInt(mm) - 1]} ${parseInt(dd)}`;
}

function isActiveToday(ts) {
  if (!ts) return false;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = "blue" }) {
  // Assign to uppercase so JSX treats it as a component reference
  const Icon = icon;
  const colorMap = {
    blue:   { bg: "bg-blue-50",   ico: "text-blue-500",  val: "text-blue-700" },
    green:  { bg: "bg-green-50",  ico: "text-green-500", val: "text-green-700" },
    amber:  { bg: "bg-amber-50",  ico: "text-amber-500", val: "text-amber-700" },
    violet: { bg: "bg-violet-50", ico: "text-violet-500",val: "text-violet-700" },
  };
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm">
      <div className={cn("rounded-lg p-2.5 shrink-0", c.bg)}>
        <Icon className={cn("h-5 w-5", c.ico)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold mt-0.5 truncate", c.val)}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Custom pie label showing %
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle"
      dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// Custom tooltip for pie
function PieTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-800">{name}</p>
      <p className="text-slate-500">{fmtMinutes(value)} total</p>
    </div>
  );
}

// Student daily chart (loaded on demand)
function StudentDailyChart({ uid }) {
  const [days, setDays] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dates = getLast30Days();
    getDocs(query(collection(db, "usage", uid, "daily"), orderBy("date", "asc")))
      .then((snap) => {
        const map = {};
        snap.docs.forEach((d) => { map[d.data().date] = d.data().minutes ?? 0; });
        setDays(dates.map((iso) => ({
          label: formatDayLabel(iso),
          minutes: map[iso] ?? 0,
        })));
      })
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return (
    <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-xs">Loading activity…</span>
    </div>
  );

  const hasData = days?.some((d) => d.minutes > 0);
  if (!hasData) return (
    <p className="text-xs text-center text-slate-400 py-8">No activity recorded in the last 30 days.</p>
  );

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={days} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          interval={4}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}m`}
        />
        <ReTooltip
          formatter={(v) => [fmtMinutes(v), "Active time"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="minutes"
          stroke="#3b82f6"
          strokeWidth={2}
          fill={`url(#grad-${uid})`}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StatsPanel() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [expandedUid, setExpandedUid] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await getDocs(collection(db, "usage"));
      setSummaries(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const branches = [...new Set(summaries.map((s) => s.branch).filter(Boolean))].sort();

  const filtered = branchFilter
    ? summaries.filter((s) => s.branch === branchFilter)
    : summaries;

  const totalMinutes  = filtered.reduce((a, s) => a + (s.totalMinutes ?? 0), 0);
  const tracked       = filtered.length;
  const avgMinutes    = tracked > 0 ? Math.round(totalMinutes / tracked) : 0;
  const activeToday   = filtered.filter((s) => isActiveToday(s.lastSeen)).length;

  // Branch aggregates
  const branchMap = {};
  summaries.forEach((s) => {
    const b = s.branch || "Unknown";
    if (!branchMap[b]) branchMap[b] = { branch: b, totalMinutes: 0, count: 0 };
    branchMap[b].totalMinutes += s.totalMinutes ?? 0;
    branchMap[b].count += 1;
  });
  const branchAgg = Object.values(branchMap)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const pieData = branchAgg.map((b) => ({ name: b.branch, value: b.totalMinutes }));
  const barAvgData = branchAgg.map((b) => ({
    branch: b.branch,
    avgMinutes: b.count > 0 ? Math.round(b.totalMinutes / b.count) : 0,
    students: b.count,
  }));
  const mostActiveBranch = branchAgg[0]?.branch ?? "—";

  // Top 10 students (by total minutes) from filtered set
  const topStudents = [...filtered]
    .filter((s) => (s.totalMinutes ?? 0) > 0)
    .sort((a, b) => (b.totalMinutes ?? 0) - (a.totalMinutes ?? 0))
    .slice(0, 10)
    .map((s) => ({
      name: (s.email ?? "").split("@")[0],
      email: s.email,
      branch: s.branch ?? "—",
      minutes: s.totalMinutes ?? 0,
      uid: s.uid,
    }));

  // All students sorted for the table
  const tableData = [...filtered]
    .sort((a, b) => (b.totalMinutes ?? 0) - (a.totalMinutes ?? 0));

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading usage statistics…</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertCircle className="h-5 w-5 text-red-400" />
      <p className="text-sm text-red-500">{error}</p>
      <button onClick={load} className="text-xs text-blue-600 hover:underline">Retry</button>
    </div>
  );

  if (summaries.length === 0) return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="rounded-full bg-slate-100 p-4">
        <Activity className="h-6 w-6 text-slate-400" />
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
    <div className="space-y-7">

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Branch filter */}
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-slate-200 py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {fmtDate(lastRefresh)}
            </span>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Tracked Students"
          value={tracked}
          sub={branchFilter ? `in ${branchFilter}` : "across all branches"}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="Avg Active Time"
          value={fmtMinutes(avgMinutes)}
          sub="per tracked student"
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Most Active Branch"
          value={mostActiveBranch}
          sub={`${fmtMinutes(branchAgg[0]?.totalMinutes ?? 0)} total`}
          color="amber"
        />
        <StatCard
          icon={Activity}
          label="Active Today"
          value={activeToday}
          sub={`of ${tracked} tracked`}
          color="violet"
        />
      </div>

      {/* ── Charts row 1: Pie + Avg Bar ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Pie chart: total minutes by branch */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Usage Share by Branch</h3>
          <p className="text-xs text-slate-400 mb-4">Total active minutes per branch</p>
          {pieData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No branch data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={PieLabel}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <ReTooltip content={<PieTooltipContent />} />
                <Legend
                  formatter={(v) => (
                    <span className="text-xs text-slate-700">{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar chart: average minutes per student by branch */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Avg Time per Student · by Branch</h3>
          <p className="text-xs text-slate-400 mb-4">Average active minutes per student in each branch</p>
          {barAvgData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={barAvgData}
                margin={{ top: 8, right: 8, left: -16, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="branch"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  angle={-25}
                  textAnchor="end"
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}m`}
                />
                <ReTooltip
                  formatter={(v, n, props) => [
                    fmtMinutes(v),
                    `Avg (${props.payload.students} students)`,
                  ]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Bar dataKey="avgMinutes" radius={[4, 4, 0, 0]}>
                  {barAvgData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Charts row 2: Total minutes bar + Student count bar ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Total minutes by branch */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Total Usage by Branch</h3>
          <p className="text-xs text-slate-400 mb-4">Combined active minutes across all students per branch</p>
          {branchAgg.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={branchAgg}
                margin={{ top: 8, right: 8, left: -16, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="branch"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  angle={-25}
                  textAnchor="end"
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}m`}
                />
                <ReTooltip
                  formatter={(v) => [fmtMinutes(v), "Total"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Bar dataKey="totalMinutes" radius={[4, 4, 0, 0]}>
                  {branchAgg.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Student count by branch */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Student Count by Branch</h3>
          <p className="text-xs text-slate-400 mb-4">How many students per branch have any tracked usage</p>
          {branchAgg.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={branchAgg}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 40, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="branch"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <ReTooltip
                  formatter={(v) => [v, "Students"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {branchAgg.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Top 10 leaderboard ── */}
      {topStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Top Students by Active Time</h3>
          <p className="text-xs text-slate-400 mb-5">
            {branchFilter ? `Top 10 in ${branchFilter}` : "Top 10 across all branches"}
          </p>
          <ResponsiveContainer width="100%" height={Math.max(200, topStudents.length * 40)}>
            <BarChart
              data={topStudents}
              layout="vertical"
              margin={{ top: 0, right: 64, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <ReTooltip
                formatter={(v, _, props) => [fmtMinutes(v), props.payload.email]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                {topStudents.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── All students table with expandable daily chart ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Student Activity</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any row to see their 30-day activity chart
            </p>
          </div>
          <span className="text-xs text-slate-400">{tableData.length} students</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Active</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tableData.map((s, i) => {
                const isExpanded = expandedUid === s.uid;
                const isToday = isActiveToday(s.lastSeen);
                return (
                  <>
                    <tr
                      key={s.uid}
                      onClick={() => setExpandedUid(isExpanded ? null : s.uid)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium truncate max-w-[200px]">
                        {s.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {s.branch ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {s.branch}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {fmtMinutes(s.totalMinutes ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {isToday && (
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                          )}
                          <span className={cn("text-xs", isToday ? "text-green-600 font-medium" : "text-slate-400")}>
                            {fmtDate(s.lastSeen)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />
                        }
                      </td>
                    </tr>

                    {/* Expandable daily chart */}
                    {isExpanded && (
                      <tr key={`${s.uid}-detail`} className="bg-slate-50">
                        <td colSpan={6} className="px-6 pt-3 pb-5">
                          <p className="text-xs font-semibold text-slate-600 mb-3">
                            {s.email} — daily activity (last 30 days)
                          </p>
                          <StudentDailyChart uid={s.uid} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 pb-2">
        Active time is measured while the portal tab is visible and focused. Idle time is excluded.
      </p>
    </div>
  );
}
