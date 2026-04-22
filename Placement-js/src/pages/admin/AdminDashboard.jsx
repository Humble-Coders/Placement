import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  Briefcase,
  Users,
  GraduationCap,
  BarChart2,
  Settings2,
  LogOut,
  ShieldCheck,
  Upload,
  Loader2,
  ExternalLink,
  FileQuestion,
  Trophy,
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import CompanyManager from "../../components/admin/CompanyManager";
import RoleManager from "../../components/admin/RoleManager";
import BranchManager from "../../components/admin/BranchManager";
import StudentList from "../../components/admin/StudentList";
import ExcelUpload from "../../components/admin/ExcelUpload";
import StatsPanel from "../../components/admin/StatsPanel";
import LLMConfig from "../../components/admin/LLMConfig";
import QuestionsManager from "../../components/admin/QuestionsManager";
import LeaderboardPanel from "../../components/admin/LeaderboardPanel";
import { cn } from "../../components/ui/utils";

const TABS = [
  { id: "questions", label: "Questions",  icon: FileQuestion },
  { id: "companies", label: "Companies",  icon: Building2 },
  { id: "roles",     label: "Roles",      icon: Briefcase },
  { id: "branches",  label: "Branches",   icon: GraduationCap },
  { id: "students",    label: "Students",    icon: Users },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "stats",       label: "Statistics",  icon: BarChart2 },
  { id: "config",    label: "Config",     icon: Settings2 },
];

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("questions");
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [studentRefreshKey, setStudentRefreshKey] = useState(0);

  const loadAll = async () => {
    setLoadingData(true);
    try {
      const [companiesSnap, rolesSnap, branchesSnap, questionsSnap] = await Promise.all([
        getDocs(collection(db, "companies")),
        getDocs(collection(db, "roles")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "questions")),
      ]);
      setCompanies(
        companiesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setRoles(
        rolesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setBranches(
        branchesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setQuestions(
        questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    } catch (err) {
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      toast.error("Failed to sign out.");
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-base font-semibold text-slate-900 tracking-tight">HumblePrep</span>
              <span className="ml-2 hidden sm:inline text-xs font-medium text-white bg-blue-600 px-2 py-0.5 rounded-full">
                Admin Panel
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-medium text-slate-700 max-w-[180px] truncate">
                {user?.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
            >
              {signingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page title */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Placement Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage companies, roles, question sets, and student records.
          </p>

          {/* Stats + Form link */}
          {!loadingData && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3.5 py-2">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">{companies.length}</span>
                <span className="text-xs text-blue-500">Companies</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2">
                <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">{roles.length}</span>
                <span className="text-xs text-slate-400">Roles</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3.5 py-2">
                <GraduationCap className="h-3.5 w-3.5 text-green-600" />
                <span className="text-sm font-semibold text-green-700">{branches.length}</span>
                <span className="text-xs text-green-500">Branches</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-3.5 py-2">
                <FileQuestion className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-sm font-semibold text-violet-700">{questions.length}</span>
                <span className="text-xs text-violet-500">Question Sets</span>
              </div>
              <a
                href="/form"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Student Form
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {loadingData && tab !== "students" ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <>
              {tab === "questions" && (
                <QuestionsManager
                  questions={questions}
                  companies={companies}
                  roles={roles}
                  branches={branches}
                  onRefresh={loadAll}
                />
              )}
              {tab === "companies" && (
                <CompanyManager companies={companies} roles={roles} onRefresh={loadAll} />
              )}
              {tab === "roles" && (
                <RoleManager roles={roles} onRefresh={loadAll} />
              )}
              {tab === "branches" && (
                <BranchManager branches={branches} onRefresh={loadAll} />
              )}
              {tab === "students" && (
                <div className="space-y-8">
                  <StudentList refreshKey={studentRefreshKey} />
                  <div className="border-t border-slate-100 pt-8">
                    <div className="flex items-center gap-2 mb-5">
                      <Upload className="h-4 w-4 text-blue-500" />
                      <h2 className="text-base font-semibold text-slate-800">Bulk Upload</h2>
                    </div>
                    <ExcelUpload onUploaded={() => setStudentRefreshKey((k) => k + 1)} />
                  </div>
                </div>
              )}
              {tab === "leaderboard" && <LeaderboardPanel />}
              {tab === "stats"  && <StatsPanel />}
              {tab === "config" && <LLMConfig />}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between text-xs text-slate-400">
          <span>HumblePrep · Admin Panel</span>
          <span>Thapar University Placements</span>
        </div>
      </footer>
    </div>
  );
}
