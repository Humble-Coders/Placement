import { useState, useMemo } from "react";
import { Search, BookOpen, ArrowLeft, Briefcase } from "lucide-react";

function hiringLabel(status) {
  if (status === "I") return "Internship";
  if (status === "FT") return "Full Time";
  if (status === "I+FT") return "Internship + Full Time";
  return null;
}
import { Input } from "./ui/input";
import ResultCard from "./ResultCard";
import QuestionDetail from "./QuestionDetail";
import { getQuestionsByCompany } from "../lib/data";

export default function SearchByCompany({ data }) {
  const [query, setQuery]         = useState("");
  const [selected, setSelected]   = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return data.companies;
    const q = query.toLowerCase();
    return data.companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, data.companies]);

  const companyDocs = useMemo(() => {
    if (!selected) return [];
    return getQuestionsByCompany(data.questions, selected.id).sort((a, b) =>
      a.role_name.localeCompare(b.role_name)
    );
  }, [selected, data.questions]);

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
                onClick={() => setActiveDoc(doc)}
              />
            ))
          )}
        </div>
      </div>
    );

  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search company name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>
      <p className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
        {filtered.length} {filtered.length !== 1 ? "companies" : "company"}
      </p>
      <div className="space-y-2">
        {filtered.map((c) => {
          const count = getQuestionsByCompany(data.questions, c.id).length;
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
