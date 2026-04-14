import { useState, useMemo } from "react";
import { BookOpen, ChevronRight, ArrowLeft, GraduationCap, Briefcase } from "lucide-react";

function hiringLabel(status) {
  if (status === "I") return "Internship";
  if (status === "FT") return "Full Time";
  if (status === "I+FT") return "Internship + Full Time";
  return null;
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import ResultCard from "./ResultCard";
import QuestionDetail from "./QuestionDetail";
import { getCompaniesByBranch, getQuestionsByCompany } from "../lib/data";

export default function SearchByBranch({ data }) {
  const [branch, setBranch]       = useState("");
  const [selected, setSelected]   = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  const uniqueBranches = useMemo(() => {
    const seen = new Map();
    data.branches.forEach((b) => {
      const key = b.name.trim();
      if (!seen.has(key)) seen.set(key, b);
    });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.branches]);

  const companiesForBranch = useMemo(() => {
    if (!branch) return [];
    return getCompaniesByBranch(data.questions, data.companies, branch);
  }, [branch, data]);

  const companyDocs = useMemo(() => {
    if (!selected) return [];
    const lower = branch.toLowerCase();
    return getQuestionsByCompany(data.questions, selected.id)
      .filter((q) => {
        const inBranches = Array.isArray(q.branches) && q.branches.some((b) => b.toLowerCase() === lower);
        const inOfficialBranches = Array.isArray(q.official_branches) && q.official_branches.some((b) => b.toLowerCase() === lower);
        return inBranches || inOfficialBranches;
      })
      .sort((a, b) => a.role_name.localeCompare(b.role_name));
  }, [selected, branch, data.questions]);

  if (activeDoc)
    return <QuestionDetail doc={activeDoc} onBack={() => setActiveDoc(null)} />;

  if (selected)
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelected(null)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
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
                onClick={() => setActiveDoc(doc)}
              />
            ))
          )}
        </div>
      </div>
    );

  return (
    <div>
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Select your branch</p>
        <Select value={branch} onValueChange={(v) => { setBranch(v); setSelected(null); }}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a branch…" />
          </SelectTrigger>
          <SelectContent>
            {uniqueBranches.map((b) => (
              <SelectItem key={b.id} value={b.name}>
                {b.name}
              </SelectItem>
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
                const count = getQuestionsByCompany(data.questions, c.id).filter((q) => {
                  const inBranches = Array.isArray(q.branches) && q.branches.some((b) => b.toLowerCase() === lower);
                  const inOfficialBranches = Array.isArray(q.official_branches) && q.official_branches.some((b) => b.toLowerCase() === lower);
                  return inBranches || inOfficialBranches;
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
          <p className="text-sm text-slate-400">Select your branch above to see which companies visited</p>
        </div>
      )}
    </div>
  );
}
