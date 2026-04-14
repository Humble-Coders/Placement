import { useState } from "react";
import { Building2, Briefcase, GraduationCap, AlertCircle, BookOpen, LogOut, Loader2, PenLine } from "lucide-react";
import { useData } from "../hooks/useData";
import { useAuth } from "../context/AuthContext";
import { useUsageTracker } from "../hooks/useUsageTracker";
import SearchByCompany from "../components/SearchByCompany";
import SearchByRole from "../components/SearchByRole";
import SearchByBranch from "../components/SearchByBranch";
import { cn } from "../components/ui/utils";

const TABS = [
  { id: "company", label: "By Company", icon: Building2 },
  { id: "role",    label: "By Role",    icon: Briefcase },
  { id: "branch",  label: "By Branch",  icon: GraduationCap },
];

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8fafc]">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
      <p className="text-sm font-medium text-slate-500">Loading placement data…</p>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center bg-[#f8fafc]">
      <div className="rounded-full bg-red-50 p-3 ring-1 ring-red-100">
        <AlertCircle className="h-5 w-5 text-red-500" />
      </div>
      <div>
        <h2 className="text-slate-900 mb-1">Failed to load data</h2>
        <p className="max-w-sm text-sm text-slate-500">{message}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="mt-1 rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-600 transition-all"
      >
        Try Again
      </button>
    </div>
  );
}

export default function Home() {
  const { data, loading, error } = useData();
  const { user, role, signOut } = useAuth();
  const [tab, setTab] = useState("company");
  const [signingOut, setSigningOut] = useState(false);

  // Start usage tracking — measures active visible time, flushes on tab switch / unload
  useUsageTracker(user, role);

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); } catch { setSigningOut(false); }
  };

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} />;
  if (!data)   return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-base font-semibold text-slate-900 tracking-tight">HumblePrep</span>
              <span className="ml-2 hidden sm:inline text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Placement Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="font-semibold text-slate-800">{data.questions.length}</span>
              <span>role buckets</span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="font-semibold text-slate-800">{data.companies.length}</span>
              <span>companies</span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <a
              href="/form"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share Experience</span>
            </a>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <span className="hidden sm:inline text-xs text-slate-400 max-w-[160px] truncate">{user?.email}</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
              title="Sign out"
            >
              {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-10 animate-fade-in">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Placement Interview Questions
          </h1>
          <p className="mt-2 text-slate-500 text-sm leading-relaxed max-w-xl">
            Crowdsourced questions from student experiences. Browse by company, role, or your branch to prepare for placement interviews.
          </p>

          {/* Stats pills */}
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3.5 py-2">
              <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="text-sm font-semibold text-blue-700">{data.companies.length}</span>
              <span className="text-xs text-blue-500">Companies</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2">
              <Briefcase className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-700">{data.roles.length}</span>
              <span className="text-xs text-slate-400">Role Categories</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2">
              <BookOpen className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-700">{data.questions.length}</span>
              <span className="text-xs text-slate-400">Question Sets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
        {/* Tab Bar */}
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 shadow-sm mb-6 animate-fade-in">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(" ")[1]}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="portal-card p-6 animate-fade-in">
          {tab === "company" && <SearchByCompany data={data} />}
          {tab === "role"    && <SearchByRole    data={data} />}
          {tab === "branch"  && <SearchByBranch  data={data} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
                <BookOpen className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">HumblePrep</p>
                <p className="text-xs text-slate-400">Placement Interview Portal · Batch 2026</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
              <p className="text-xs text-slate-400">Data from student feedback. For informational use only.</p>
              <div className="h-3 w-px bg-slate-200 hidden sm:block" />
              <div className="text-xs text-slate-500">
                Built by{" "}
                <span className="font-semibold text-slate-700">Humble Solutions</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
