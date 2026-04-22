import { useState, useMemo } from "react";
import {
  Building2, Briefcase, GraduationCap, BookOpen, Search,
  AlertCircle, ChevronRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import ResultCard from "../ResultCard";
import AdminQuestionDetail from "./AdminQuestionDetail";
import {
  getQuestionsByCompany,
  getQuestionsByRole,
  getQuestionsByBranch,
  getCompaniesByBranch,
} from "../../lib/data";
import { cn } from "../ui/utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

function hiringLabel(status) {
  if (status === "I")    return "Internship";
  if (status === "FT")   return "Full Time";
  if (status === "I+FT") return "Internship + Full Time";
  return null;
}

const TABS = [
  { id: "company", label: "By Company", icon: Building2 },
  { id: "role",    label: "By Role",    icon: Briefcase },
  { id: "branch",  label: "By Branch",  icon: GraduationCap },
];

// ─── Tab: By Company ──────────────────────────────────────────────────────────

function CompanyTab({ questions, companies, onOpenDoc }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return companies;
    const q = query.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, companies]);

  const companyDocs = useMemo(() => {
    if (!selected) return [];
    return getQuestionsByCompany(questions, selected.id)
      .sort((a, b) => a.role_name.localeCompare(b.role_name));
  }, [selected, questions]);

  if (selected) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelected(null)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to companies
        </button>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {companyDocs.length} role{companyDocs.length !== 1 ? "s" : ""} with interview data
          </p>
        </div>
        <div className="space-y-3">
          {companyDocs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 italic">No questions available for this company.</p>
          ) : (
            companyDocs.map((doc) => (
              <ResultCard
                key={doc.id}
                title={doc.role_name}
                subtitle={`${(doc.official_roles?.length > 0 ? doc.official_roles : doc.role_labels)?.length ?? 0} specific roles reported`}
                meta={[
                  { icon: <BookOpen className="h-3 w-3" />, label: `${(doc.technical_questions?.length ?? 0) + (doc.hr_questions?.length ?? 0)} questions` },
                  ...(hiringLabel(doc.hiring_status) ? [{ icon: <Briefcase className="h-3 w-3" />, label: hiringLabel(doc.hiring_status) }] : []),
                ]}
                tags={doc.official_roles?.length > 0 ? doc.official_roles : doc.role_labels}
                onClick={() => onOpenDoc(doc)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company name…"
          autoFocus
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <p className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
        {filtered.length} {filtered.length !== 1 ? "companies" : "company"}
      </p>
      <div className="space-y-2">
        {filtered.map((c) => {
          const count = getQuestionsByCompany(questions, c.id).length;
          return (
            <ResultCard
              key={c.id}
              title={c.name}
              meta={[{ label: `${count} role bucket${count !== 1 ? "s" : ""}` }]}
              onClick={() => setSelected(c)}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No companies match &ldquo;{query}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab: By Role ─────────────────────────────────────────────────────────────

function RoleTab({ questions, roles, onOpenDoc }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return roles;
    const q = query.toLowerCase();
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [query, roles]);

  const roleDocs = useMemo(() => {
    if (!selected) return [];
    return getQuestionsByRole(questions, selected.id)
      .sort((a, b) => a.company_name.localeCompare(b.company_name));
  }, [selected, questions]);

  if (selected) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelected(null)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to roles
        </button>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {roleDocs.length} {roleDocs.length !== 1 ? "companies" : "company"} hiring for this role
          </p>
        </div>
        <div className="space-y-3">
          {roleDocs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 italic">No questions available for this role.</p>
          ) : (
            roleDocs.map((doc) => (
              <ResultCard
                key={doc.id}
                title={doc.company_name}
                subtitle={doc.role_name}
                meta={[
                  { icon: <BookOpen className="h-3 w-3" />, label: `${(doc.technical_questions?.length ?? 0) + (doc.hr_questions?.length ?? 0)} questions` },
                  ...(hiringLabel(doc.hiring_status) ? [{ icon: <Briefcase className="h-3 w-3" />, label: hiringLabel(doc.hiring_status) }] : []),
                ]}
                tags={doc.topics?.slice(0, 5)}
                onClick={() => onOpenDoc(doc)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search role or category…"
          autoFocus
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <p className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
        {filtered.length} {filtered.length !== 1 ? "roles" : "role"}
      </p>
      <div className="space-y-2">
        {filtered.map((r) => {
          const count = getQuestionsByRole(questions, r.id).length;
          return (
            <ResultCard
              key={r.id}
              title={r.name}
              meta={[{ label: `${count} ${count !== 1 ? "companies" : "company"}` }]}
              onClick={() => setSelected(r)}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No roles match &ldquo;{query}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab: By Branch ───────────────────────────────────────────────────────────

function BranchTab({ questions, companies, branches, onOpenDoc }) {
  const [branch, setBranch] = useState("");
  const [selected, setSelected] = useState(null);

  const uniqueBranches = useMemo(() => {
    const seen = new Map();
    branches.forEach((b) => { if (!seen.has(b.name)) seen.set(b.name, b); });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [branches]);

  const companiesForBranch = useMemo(
    () => branch ? getCompaniesByBranch(questions, companies, branch) : [],
    [branch, questions, companies]
  );

  const companyDocs = useMemo(() => {
    if (!selected || !branch) return [];
    const lower = branch.toLowerCase();
    return getQuestionsByCompany(questions, selected.id)
      .filter((q) => {
        const inB  = Array.isArray(q.branches)          && q.branches.some((b) => b.toLowerCase() === lower);
        const inOB = Array.isArray(q.official_branches)  && q.official_branches.some((b) => b.toLowerCase() === lower);
        return inB || inOB;
      })
      .sort((a, b) => a.role_name.localeCompare(b.role_name));
  }, [selected, branch, questions]);

  if (selected) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelected(null)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to companies
        </button>
        <div className="mb-1 inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
          <GraduationCap className="h-3 w-3" />
          <span>{branch}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-slate-600">{selected.name}</span>
        </div>
        <div className="mt-4 mb-5">
          <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
        </div>
        <div className="space-y-3">
          {companyDocs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 italic">No questions found.</p>
          ) : (
            companyDocs.map((doc) => (
              <ResultCard
                key={doc.id}
                title={doc.role_name}
                subtitle={`${(doc.official_roles?.length > 0 ? doc.official_roles : doc.role_labels)?.length ?? 0} specific roles reported`}
                meta={[
                  { icon: <BookOpen className="h-3 w-3" />, label: `${(doc.technical_questions?.length ?? 0) + (doc.hr_questions?.length ?? 0)} questions` },
                  ...(hiringLabel(doc.hiring_status) ? [{ icon: <Briefcase className="h-3 w-3" />, label: hiringLabel(doc.hiring_status) }] : []),
                ]}
                tags={doc.official_roles?.length > 0 ? doc.official_roles : doc.role_labels}
                onClick={() => onOpenDoc(doc)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Select a branch</p>
        <Select value={branch} onValueChange={(v) => { setBranch(v); setSelected(null); }}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a branch…" />
          </SelectTrigger>
          <SelectContent>
            {uniqueBranches.map((b) => (
              <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {branch && (
        <>
          <p className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
            {companiesForBranch.length} {companiesForBranch.length !== 1 ? "companies" : "company"} visited{" "}
            <span className="text-blue-600 normal-case font-semibold">{branch}</span>
          </p>
          <div className="space-y-2">
            {companiesForBranch.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No companies found for this branch.</p>
            ) : (
              companiesForBranch.map((c) => {
                const lower = branch.toLowerCase();
                const count = getQuestionsByCompany(questions, c.id).filter((q) => {
                  const inB  = Array.isArray(q.branches)         && q.branches.some((b) => b.toLowerCase() === lower);
                  const inOB = Array.isArray(q.official_branches) && q.official_branches.some((b) => b.toLowerCase() === lower);
                  return inB || inOB;
                }).length;
                return (
                  <ResultCard
                    key={c.id}
                    title={c.name}
                    meta={[{ label: `${count} role bucket${count !== 1 ? "s" : ""}` }]}
                    onClick={() => setSelected(c)}
                  />
                );
              })
            )}
          </div>
        </>
      )}

      {!branch && (
        <div className="py-14 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Select a branch above to see which companies visited</p>
        </div>
      )}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function QuestionsManager({ questions, companies, roles, branches, onRefresh }) {
  const [tab, setTab] = useState("company");
  const [activeDoc, setActiveDoc] = useState(null);

  const handleOpenDoc = (doc) => setActiveDoc(doc);

  const handleSaved = (updatedDoc) => {
    setActiveDoc(updatedDoc);
    onRefresh();
  };

  if (activeDoc) {
    return (
      <AdminQuestionDetail
        item={activeDoc}
        allBranches={branches}
        onBack={() => setActiveDoc(null)}
        onSaved={handleSaved}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="rounded-full bg-slate-100 p-4">
          <AlertCircle className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">No question sets yet. Process student responses in the Config tab.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200 mb-6">
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
                  : "text-slate-500 hover:text-slate-800 hover:bg-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "company" && (
        <CompanyTab questions={questions} companies={companies} onOpenDoc={handleOpenDoc} />
      )}
      {tab === "role" && (
        <RoleTab questions={questions} roles={roles} onOpenDoc={handleOpenDoc} />
      )}
      {tab === "branch" && (
        <BranchTab questions={questions} companies={companies} branches={branches} onOpenDoc={handleOpenDoc} />
      )}
    </div>
  );
}
