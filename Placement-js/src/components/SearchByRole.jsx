import { useState, useMemo } from "react";
import { Search, BookOpen, ArrowLeft } from "lucide-react";
import { Input } from "./ui/input";
import ResultCard from "./ResultCard";
import QuestionDetail from "./QuestionDetail";
import { getQuestionsByRole } from "../lib/data";

export default function SearchByRole({ data }) {
  const [query, setQuery]         = useState("");
  const [selected, setSelected]   = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return data.roles;
    const q = query.toLowerCase();
    return data.roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [query, data.roles]);

  const roleDocs = useMemo(() => {
    if (!selected) return [];
    return getQuestionsByRole(data.questions, selected.id).sort((a, b) =>
      a.company_name.localeCompare(b.company_name)
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
                  { label: `${doc.response_count ?? 0} responses` },
                ]}
                tags={doc.topics?.slice(0, 5)}
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
          placeholder="Search role or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>
      <p className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
        {filtered.length} {filtered.length !== 1 ? "roles" : "role"}
      </p>
      <div className="space-y-2">
        {filtered.map((r) => {
          const count = getQuestionsByRole(data.questions, r.id).length;
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
