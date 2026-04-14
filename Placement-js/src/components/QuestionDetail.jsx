import { ArrowLeft, BookOpen, Users, Lightbulb, Layers, Building2, Briefcase, MessageSquare } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

function TopicBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
      {children}
    </span>
  );
}

function BranchBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
      {children}
    </span>
  );
}

function RoleBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
      {children}
    </span>
  );
}

function QuestionList({ questions, emptyText }) {
  if (!questions || questions.length === 0)
    return (
      <p className="text-sm text-slate-400 italic py-2">{emptyText}</p>
    );
  return (
    <ol className="space-y-0">
      {questions.map((q, i) => (
        <li key={i} className={`flex gap-4 py-4 ${i < questions.length - 1 ? "border-b border-slate-100" : ""}`}>
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600">
            {i + 1}
          </span>
          <span className="text-sm text-slate-700 leading-relaxed">{q}</span>
        </li>
      ))}
    </ol>
  );
}

const HIRING_STATUS_LABELS = { I: "Internship", FT: "Full Time", "I+FT": "Internship + Full Time" };

export default function QuestionDetail({ doc, onBack }) {
  const totalQuestions = (doc.technical_questions?.length ?? 0) + (doc.hr_questions?.length ?? 0);
  const displayRoles = doc.official_roles?.length > 0 ? doc.official_roles : doc.role_labels;
  const displayBranches = doc.official_branches?.length > 0 ? doc.official_branches : doc.branches;

  const sections = [
    {
      id: "technical",
      icon: <BookOpen className="h-4 w-4" />,
      label: "Technical Questions",
      sub: "Reported by students",
      count: doc.technical_questions?.length ?? 0,
      content: <QuestionList questions={doc.technical_questions} emptyText="No technical questions recorded." />,
      color: "text-blue-600 bg-blue-50",
    },
    {
      id: "hr",
      icon: <Users className="h-4 w-4" />,
      label: "HR Questions",
      sub: "Reported by students",
      count: doc.hr_questions?.length ?? 0,
      content: <QuestionList questions={doc.hr_questions} emptyText="No HR questions recorded." />,
      color: "text-violet-600 bg-violet-50",
    },
    {
      id: "additional",
      icon: <Lightbulb className="h-4 w-4" />,
      label: "Additional Practice Questions",
      sub: "AI-researched, company-specific",
      count: doc.additional_questions?.length ?? 0,
      content: <QuestionList questions={doc.additional_questions} emptyText="No additional questions available." />,
      color: "text-amber-600 bg-amber-50",
    },
    {
      id: "topics",
      icon: <Layers className="h-4 w-4" />,
      label: "Topics & Skills",
      sub: "What the company tests",
      count: doc.topics?.length ?? 0,
      content: (
        <div className="flex flex-wrap gap-2 py-2">
          {doc.topics?.length > 0
            ? doc.topics.map((t, i) => <TopicBadge key={i}>{t}</TopicBadge>)
            : <p className="text-sm text-slate-400 italic">No topics listed.</p>
          }
        </div>
      ),
      color: "text-emerald-600 bg-emerald-50",
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to results
      </button>

      {/* Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-5">
        {/* Blue accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-blue-700" />

        <div className="p-6">
          {/* Company + Role breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{doc.company_name}</span>
            <span className="text-slate-300">›</span>
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span>{doc.role_name}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{doc.company_name}</h2>
              <p className="mt-0.5 text-sm font-medium text-blue-600">{doc.role_name}</p>
              {doc.hiring_status && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(doc.hiring_status === "I" || doc.hiring_status === "I+FT") && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Internship
                    </span>
                  )}
                  {(doc.hiring_status === "FT" || doc.hiring_status === "I+FT") && (
                    <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      Full Time
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              <div className="text-center rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 min-w-[72px]">
                <div className="text-xl font-bold text-blue-700">{totalQuestions}</div>
                <div className="text-[10px] font-medium text-blue-400 uppercase tracking-wide mt-0.5">Questions</div>
              </div>
            </div>
          </div>

          {/* Role Labels */}
          {displayRoles?.length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                <MessageSquare className="h-3 w-3" />
                {doc.official_roles?.length > 0 ? "Official roles" : "Actual roles reported by students"}
              </p>
              <div className="flex flex-wrap gap-2">
                {displayRoles.map((r, i) => <RoleBadge key={i}>{r}</RoleBadge>)}
              </div>
            </div>
          )}

          {/* Eligible Branches */}
          {displayBranches?.length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Eligible Branches</p>
              <div className="flex flex-wrap gap-1.5">
                {displayBranches.map((b, i) => <BranchBadge key={i}>{b}</BranchBadge>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Accordion type="multiple" defaultValue={["technical", "hr"]}>
          {sections.map((s, idx) => (
            <AccordionItem
              key={s.id}
              value={s.id}
              className={idx === sections.length - 1 ? "border-b-0" : ""}
            >
              <AccordionTrigger className="px-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}>
                    {s.icon}
                  </span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-800">{s.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                  {s.count > 0 && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {s.count}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5 pt-0">
                <div className="pl-11">
                  {s.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
