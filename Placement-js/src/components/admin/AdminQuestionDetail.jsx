import { useState } from "react";
import {
  ArrowLeft, BookOpen, Users, Lightbulb, Layers, Building2, Briefcase,
  MessageSquare, Pencil, Save, X, Plus, Trash2, Loader2, GraduationCap,
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

// ─── Small reusable pieces ────────────────────────────────────────────────────

function TopicBadge({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="rounded-full text-blue-400 hover:text-blue-700 p-0.5 transition">
          <X className="h-3 w-3" />
        </button>
      )}
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

function RoleBadge({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="rounded-full text-slate-400 hover:text-slate-700 p-0.5 transition">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// Read-only question list (view mode)
function QuestionList({ questions, emptyText }) {
  if (!questions?.length)
    return <p className="text-sm text-slate-400 italic py-2">{emptyText}</p>;
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

// Editable question list (edit mode)
function EditableQuestionList({ items, onChange, placeholder }) {
  const update = (i, val) => { const n = [...items]; n[i] = val; onChange(n); };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div className="space-y-2">
      {items.map((q, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600">
            {i + 1}
          </span>
          <textarea
            value={q}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-2 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition"
      >
        <Plus className="h-3.5 w-3.5" /> Add question
      </button>
    </div>
  );
}

// Editable tag list (for topics and official roles)
function EditableTagList({ items, onChange, placeholder, BadgeComponent }) {
  const [draft, setDraft] = useState("");
  const Badge = BadgeComponent ?? TopicBadge;

  const add = () => {
    const val = draft.trim();
    if (!val || items.includes(val)) return;
    onChange([...items, val]);
    setDraft("");
  };

  const remove = (item) => onChange(items.filter((x) => x !== item));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((t, i) => (
          <Badge key={i} onRemove={() => remove(t)}>{t}</Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// Branch checkbox selector (edit mode)
function BranchSelector({ allBranches, selected, onChange }) {
  const toggle = (name) => {
    if (selected.includes(name)) onChange(selected.filter((b) => b !== name));
    else onChange([...selected, name]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {allBranches.map((b) => {
        const checked = selected.includes(b.name);
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => toggle(b.name)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              checked
                ? "border-blue-300 bg-blue-100 text-blue-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            <GraduationCap className="h-3 w-3" />
            {b.name}
          </button>
        );
      })}
      {allBranches.length === 0 && (
        <p className="text-xs text-slate-400 italic">No branches defined yet.</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const HIRING_OPTIONS = [
  { value: "",     label: "Not specified" },
  { value: "I",    label: "Internship" },
  { value: "FT",   label: "Full Time" },
  { value: "I+FT", label: "Internship + Full Time" },
];

export default function AdminQuestionDetail({ item, allBranches, onBack, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);

  const set = (field) => (val) => setDraft((d) => ({ ...d, [field]: val }));

  const startEdit = () => {
    setDraft({
      hiring_status:        item.hiring_status        ?? "",
      official_roles:       [...(item.official_roles       ?? [])],
      official_branches:    [...(item.official_branches    ?? [])],
      technical_questions:  [...(item.technical_questions  ?? [])],
      hr_questions:         [...(item.hr_questions         ?? [])],
      additional_questions: [...(item.additional_questions ?? [])],
      topics:               [...(item.topics               ?? [])],
    });
    setEditing(true);
  };

  const cancelEdit = () => { setDraft(null); setEditing(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch = {
        hiring_status:        draft.hiring_status || null,
        official_roles:       draft.official_roles,
        official_branches:    draft.official_branches,
        technical_questions:  draft.technical_questions.map((q) => q.trim()).filter(Boolean),
        hr_questions:         draft.hr_questions.map((q) => q.trim()).filter(Boolean),
        additional_questions: draft.additional_questions.map((q) => q.trim()).filter(Boolean),
        topics:               draft.topics,
      };
      await updateDoc(doc(db, "questions", item.id), patch);
      toast.success("Question set saved.");
      onSaved({ ...item, ...patch });
      setEditing(false);
      setDraft(null);
    } catch (err) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Which data to display — draft in edit mode, item otherwise
  const d = editing ? draft : item;
  const totalQuestions = (d.technical_questions?.length ?? 0) + (d.hr_questions?.length ?? 0);
  const displayRoles = (editing ? d.official_roles : (item.official_roles?.length > 0 ? item.official_roles : item.role_labels)) ?? [];
  const displayBranches = (editing ? d.official_branches : (item.official_branches?.length > 0 ? item.official_branches : item.branches)) ?? [];

  const sections = [
    {
      id: "technical",
      icon: <BookOpen className="h-4 w-4" />,
      label: "Technical Questions",
      sub: editing ? "Edit below — empty lines are ignored on save" : "Reported by students",
      count: d.technical_questions?.length ?? 0,
      color: "text-blue-600 bg-blue-50",
      content: editing
        ? <EditableQuestionList items={draft.technical_questions} onChange={set("technical_questions")} placeholder="Describe the technical question…" />
        : <QuestionList questions={item.technical_questions} emptyText="No technical questions recorded." />,
    },
    {
      id: "hr",
      icon: <Users className="h-4 w-4" />,
      label: "HR Questions",
      sub: editing ? "Edit below — empty lines are ignored on save" : "Reported by students",
      count: d.hr_questions?.length ?? 0,
      color: "text-violet-600 bg-violet-50",
      content: editing
        ? <EditableQuestionList items={draft.hr_questions} onChange={set("hr_questions")} placeholder="Describe the HR question…" />
        : <QuestionList questions={item.hr_questions} emptyText="No HR questions recorded." />,
    },
    {
      id: "additional",
      icon: <Lightbulb className="h-4 w-4" />,
      label: "Additional Practice Questions",
      sub: editing ? "AI-generated — edit or remove any" : "AI-researched, company-specific",
      count: d.additional_questions?.length ?? 0,
      color: "text-amber-600 bg-amber-50",
      content: editing
        ? <EditableQuestionList items={draft.additional_questions} onChange={set("additional_questions")} placeholder="Additional practice question…" />
        : <QuestionList questions={item.additional_questions} emptyText="No additional questions available." />,
    },
    {
      id: "topics",
      icon: <Layers className="h-4 w-4" />,
      label: "Topics & Skills",
      sub: "What the company tests",
      count: d.topics?.length ?? 0,
      color: "text-emerald-600 bg-emerald-50",
      content: editing
        ? <EditableTagList items={draft.topics} onChange={set("topics")} placeholder="e.g. Dynamic Programming…" />
        : (
          <div className="flex flex-wrap gap-2 py-2">
            {item.topics?.length > 0
              ? item.topics.map((t, i) => <TopicBadge key={i}>{t}</TopicBadge>)
              : <p className="text-sm text-slate-400 italic">No topics listed.</p>
            }
          </div>
        ),
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Back + action buttons */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to results
        </button>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save changes
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 transition shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-5">
        <div className={`h-1.5 w-full ${editing ? "bg-gradient-to-r from-amber-400 to-amber-600" : "bg-gradient-to-r from-blue-500 to-blue-700"}`} />

        <div className="p-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{item.company_name}</span>
            <span className="text-slate-300">›</span>
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span>{item.role_name}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{item.company_name}</h2>
              <p className="mt-0.5 text-sm font-medium text-blue-600">{item.role_name}</p>

              {/* Hiring status */}
              <div className="mt-3">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-500">Hiring type:</label>
                    <select
                      value={draft.hiring_status}
                      onChange={(e) => set("hiring_status")(e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      {HIRING_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  item.hiring_status && (
                    <div className="flex flex-wrap gap-1.5">
                      {(item.hiring_status === "I" || item.hiring_status === "I+FT") && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Internship</span>
                      )}
                      {(item.hiring_status === "FT" || item.hiring_status === "I+FT") && (
                        <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">Full Time</span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="text-center rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 min-w-[72px]">
                <div className="text-xl font-bold text-blue-700">{totalQuestions}</div>
                <div className="text-[10px] font-medium text-blue-400 uppercase tracking-wide mt-0.5">Questions</div>
              </div>
            </div>
          </div>

          {/* Official Roles */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
              <MessageSquare className="h-3 w-3" />
              {editing ? "Official roles" : (item.official_roles?.length > 0 ? "Official roles" : "Roles reported by students")}
            </p>
            {editing ? (
              <EditableTagList
                items={draft.official_roles}
                onChange={set("official_roles")}
                placeholder="e.g. SDE-1, Software Engineer…"
                BadgeComponent={RoleBadge}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {displayRoles.length > 0
                  ? displayRoles.map((r, i) => <RoleBadge key={i}>{r}</RoleBadge>)
                  : <p className="text-xs text-slate-400 italic">No roles specified.</p>
                }
              </div>
            )}
          </div>

          {/* Eligible Branches */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Eligible Branches</p>
            {editing ? (
              <BranchSelector
                allBranches={allBranches}
                selected={draft.official_branches}
                onChange={set("official_branches")}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {displayBranches.length > 0
                  ? displayBranches.map((b, i) => <BranchBadge key={i}>{b}</BranchBadge>)
                  : <p className="text-xs text-slate-400 italic">No branches specified.</p>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Accordion type="multiple" defaultValue={["technical", "hr", "additional", "topics"]}>
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
                <div className="pl-11">{s.content}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Edit mode footer hint */}
      {editing && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}
