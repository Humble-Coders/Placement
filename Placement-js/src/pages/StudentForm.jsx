import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  Tag,
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import SearchableSelect from "../components/form/SearchableSelect";
import { cn } from "../components/ui/utils";

// ─── helpers ───────────────────────────────────────────────────────────────

function sanitizeEmail(email) {
  return email.toLowerCase().replace(/[.#$[\]]/g, "_");
}

function Field({ label, required, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// Dynamic list of text inputs (questions)
function QuestionList({ items, onChange, placeholder, minCount, error }) {
  const addItem = () => onChange([...items, ""]);
  const updateItem = (i, val) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {items.map((q, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 mt-2">
            {i + 1}
          </span>
          <textarea
            value={q}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder={placeholder}
            rows={2}
            className={cn(
              "flex-1 resize-none rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition",
              "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
              error && i < minCount && !q.trim()
                ? "border-red-300"
                : "border-slate-200"
            )}
          />
          {items.length > minCount && (
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="mt-2 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition w-full justify-center"
      >
        <Plus className="h-3.5 w-3.5" />
        Add another
      </button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// Tag-style topic input
function TopicInput({ topics, onChange, error }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const add = () => {
    const val = draft.trim();
    if (!val) return;
    if (!topics.includes(val)) onChange([...topics, val]);
    setDraft("");
    inputRef.current?.focus();
  };

  const remove = (t) => onChange(topics.filter((x) => x !== t));

  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !draft && topics.length > 0) {
      remove(topics[topics.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Existing tags */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700"
            >
              <Tag className="h-3 w-3" />
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="rounded-full text-blue-400 hover:text-blue-700 hover:bg-blue-100 p-0.5 transition"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. Dynamic Programming, System Design…"
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition",
            "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
            error && topics.length === 0 ? "border-red-300" : "border-slate-200"
          )}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      <p className="text-xs text-slate-400">Press Enter or click Add. Press Backspace to remove last tag.</p>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main form ──────────────────────────────────────────────────────────────

const INITIAL_TECH = ["", "", "", ""];
const INITIAL_HR = [""];

export default function StudentForm() {
  // Options loaded from Firestore
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Role buckets for selected company
  const [roleBuckets, setRoleBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");
  const [branch, setBranch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [officialRole, setOfficialRole] = useState("");
  const [techQuestions, setTechQuestions] = useState(INITIAL_TECH);
  const [hrQuestions, setHrQuestions] = useState(INITIAL_HR);
  const [topics, setTopics] = useState([]);

  // Profile autofill
  const [lookingUp, setLookingUp] = useState(false);
  const [profileFound, setProfileFound] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  // Submission state
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Load dropdown options
  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "companies")),
      getDocs(collection(db, "branches")),
    ])
      .then(([cSnap, bSnap]) => {
        setCompanies(
          cSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name))
        );
        setBranches(
          bSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingOptions(false));
  }, []);

  // Load role buckets when company changes
  useEffect(() => {
    if (!companyId) {
      setRoleBuckets([]);
      setRoleId("");
      setOfficialRole("");
      return;
    }
    setLoadingBuckets(true);
    setRoleId("");
    setOfficialRole("");
    getDocs(collection(db, "companies", companyId, "role_buckets"))
      .then((snap) => {
        setRoleBuckets(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => a.role_name.localeCompare(b.role_name))
        );
      })
      .catch(() => setRoleBuckets([]))
      .finally(() => setLoadingBuckets(false));
  }, [companyId]);

  // Email autofill lookup
  const handleEmailBlur = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith("@thapar.edu")) {
      setProfileFound(false);
      setProfileChecked(false);
      return;
    }
    setLookingUp(true);
    try {
      const docId = sanitizeEmail(trimmed);
      const snap = await getDoc(doc(db, "students", docId));
      if (snap.exists()) {
        const data = snap.data();
        setName(data.name ?? "");
        setRoll(data.roll ?? "");
        // Match branch id by name
        const matchedBranch = branches.find(
          (b) => b.name.toLowerCase() === (data.branch ?? "").toLowerCase()
        );
        if (matchedBranch) setBranch(matchedBranch.id);
        setProfileFound(true);
      } else {
        setProfileFound(false);
      }
      setProfileChecked(true);
    } catch {
      setProfileFound(false);
      setProfileChecked(false);
    } finally {
      setLookingUp(false);
    }
  };

  // Validation
  const validate = () => {
    const e = {};
    const trimEmail = email.trim().toLowerCase();

    if (!trimEmail) e.email = "Email is required.";
    else if (!trimEmail.endsWith("@thapar.edu"))
      e.email = "Must be a @thapar.edu email address.";

    if (!name.trim()) e.name = "Name is required.";
    if (!roll.trim()) e.roll = "Roll number is required.";
    if (!branch) e.branch = "Please select your branch.";
    if (!companyId) e.company = "Please select a company.";
    if (!roleId) e.role = "Please select a role.";

    const filledTech = techQuestions.filter((q) => q.trim());
    if (filledTech.length < 4)
      e.tech = `At least 4 technical questions required (${filledTech.length}/4 filled).`;

    const filledHr = hrQuestions.filter((q) => q.trim());
    if (filledHr.length < 1) e.hr = "At least 1 HR question required.";

    if (topics.length < 1) e.topics = "Add at least 1 topic.";

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setRetryCount(0);
    setErrors({});

    const emailLower       = email.trim().toLowerCase();
    const selectedCompany  = companies.find((c) => c.id === companyId);
    const selectedBucket   = roleBuckets.find((b) => b.role_id === roleId);
    const selectedBranch   = branches.find((b) => b.id === branch);

    // Deterministic lock key: prevents duplicate submissions for the same
    // email + company + role within 24 hours.
    const lockId   = `${sanitizeEmail(emailLower)}_${companyId}_${roleId}`;
    const lockRef  = doc(db, "submissionLocks", lockId);

    // Pre-generate the response document reference so we can use it
    // inside the transaction (addDoc cannot be used in a transaction).
    const responseRef = doc(collection(db, "raw_responses"));

    const payload = {
      email:               emailLower,
      name:                name.trim(),
      roll:                roll.trim(),
      branch:              selectedBranch?.name ?? branch,
      company_id:          companyId,
      company_name:        selectedCompany?.name ?? "",
      role_id:             roleId,
      role_name:           selectedBucket?.role_name ?? "",
      official_role:       officialRole || "",
      technical_questions: techQuestions.map((q) => q.trim()).filter(Boolean),
      hr_questions:        hrQuestions.map((q) => q.trim()).filter(Boolean),
      topics:              [...new Set(topics)],
      status:              "unprocessed",
      submittedAt:         serverTimestamp(),
    };

    const MAX_RETRIES = 3;
    let succeeded  = false;
    let lastError  = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) setRetryCount(attempt - 1);

      try {
        await runTransaction(db, async (txn) => {
          // ── Read: check for recent duplicate ───────────────────────────
          const lockSnap = await txn.get(lockRef);

          if (lockSnap.exists()) {
            const prevTs = lockSnap.data().submittedAt?.toDate?.();
            if (prevTs) {
              const hoursElapsed = (Date.now() - prevTs.getTime()) / 3_600_000;
              if (hoursElapsed < 24) {
                const dup = new Error(
                  `You already submitted for ${selectedCompany?.name ?? "this company"} ` +
                  `(${selectedBucket?.role_name ?? "this role"}) ${Math.round(hoursElapsed)}h ago. ` +
                  `Please wait 24 hours before resubmitting.`
                );
                dup.isDuplicate = true;
                throw dup;
              }
            }
          }

          // ── Write 1: save the response ──────────────────────────────────
          txn.set(responseRef, payload);

          // ── Write 2: update the dedup lock ──────────────────────────────
          txn.set(lockRef, {
            email:      emailLower,
            companyId,
            roleId,
            responseId: responseRef.id,
            submittedAt: serverTimestamp(),
          });
        });

        succeeded = true;
        break;

      } catch (err) {
        lastError = err;

        // Non-retryable: our business logic errors + auth/permission issues
        if (err.isDuplicate || err.code === "permission-denied" || err.code === "invalid-argument") {
          break;
        }

        // Retryable: transaction contention, transient network, timeout
        const isRetryable = err.code === "aborted"
          || err.code === "unavailable"
          || err.code === "deadline-exceeded";

        if (isRetryable && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 800 * attempt)); // 800 ms, 1600 ms
          continue;
        }

        break;
      }
    }

    setSubmitting(false);
    setRetryCount(0);

    if (succeeded) {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setErrors({ submit: friendlySubmitError(lastError) });
    }
  };

  function friendlySubmitError(err) {
    if (!err) return "Something went wrong. Please try again.";
    if (err.isDuplicate) return err.message;
    const map = {
      "permission-denied":  "Submission not permitted. Make sure you are using your @thapar.edu email.",
      "unavailable":        "Network unavailable. Please check your internet connection and try again.",
      "deadline-exceeded":  "Request timed out. Please check your connection and try again.",
      "resource-exhausted": "Too many requests right now. Please wait a moment and try again.",
      "aborted":            "Submission conflict — too many simultaneous requests. Please try again.",
      "invalid-argument":   "Form data is invalid. Please review your answers and try again.",
      "not-found":          "A required resource was not found. Please refresh the page and try again.",
      "internal":           "A server error occurred. Please try again in a moment.",
      "cancelled":          "Submission was cancelled. Please try again.",
    };
    return map[err.code] ?? `Submission failed: ${err.message ?? "Unknown error."}`;
  }

  const resetForm = () => {
    setEmail(""); setName(""); setRoll(""); setBranch("");
    setCompanyId(""); setRoleId(""); setOfficialRole("");
    setRoleBuckets([]);
    setTechQuestions(INITIAL_TECH); setHrQuestions(INITIAL_HR);
    setTopics([]); setErrors({}); setSubmitted(false);
    setProfileFound(false); setProfileChecked(false);
    setRetryCount(0);
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-50 border border-green-100 p-5">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Response Submitted!</h2>
            <p className="mt-2 text-sm text-slate-500">
              Thank you for sharing your experience. Your response has been saved and will help future students prepare.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={resetForm}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Submit Another
            </button>
            <a
              href="/"
              className="rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition text-center"
            >
              Go to Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-base font-semibold text-slate-900 tracking-tight">HumblePrep</span>
              <span className="ml-2 hidden sm:inline text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Share Your Experience
              </span>
            </div>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Portal</span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Share Your Placement Experience
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-lg">
            Help your juniors prepare by sharing the questions you were asked. Your submission is confidential and will be reviewed before publishing.
          </p>
        </div>
      </div>

      {/* Form */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-8">

          {/* ── Section 1: Personal Details ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Your Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter your Thapar email to auto-fill your profile.</p>
            </div>

            {/* Email */}
            <div id="field-email">
              <Field label="Thapar Email" required error={errors.email}>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setProfileChecked(false); setProfileFound(false); }}
                    onBlur={handleEmailBlur}
                    placeholder="yourname@thapar.edu"
                    className={cn(
                      "w-full rounded-lg border py-2.5 px-3 text-sm placeholder-slate-400 outline-none transition",
                      "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                      errors.email ? "border-red-300" : "border-slate-200"
                    )}
                  />
                  {lookingUp && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
                {profileChecked && profileFound && (
                  <p className="flex items-center gap-1 text-xs text-green-600 mt-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Profile found — details auto-filled.
                    <button
                      type="button"
                      onClick={() => { setProfileFound(false); setName(""); setRoll(""); setBranch(""); }}
                      className="ml-1 text-slate-400 hover:text-slate-600 underline"
                    >
                      Clear
                    </button>
                  </p>
                )}
                {profileChecked && !profileFound && (
                  <p className="text-xs text-slate-400 mt-1">No saved profile found — please fill in your details below.</p>
                )}
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {/* Name */}
              <div id="field-name">
                <Field label="Full Name" required error={errors.name}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    readOnly={profileFound}
                    className={cn(
                      "w-full rounded-lg border py-2.5 px-3 text-sm placeholder-slate-400 outline-none transition",
                      "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                      profileFound ? "bg-slate-50 text-slate-600" : "",
                      errors.name ? "border-red-300" : "border-slate-200"
                    )}
                  />
                </Field>
              </div>

              {/* Roll */}
              <div id="field-roll">
                <Field label="Roll Number" required error={errors.roll}>
                  <input
                    type="text"
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    placeholder="e.g. 102117XXX"
                    readOnly={profileFound}
                    className={cn(
                      "w-full rounded-lg border py-2.5 px-3 text-sm placeholder-slate-400 outline-none transition",
                      "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                      profileFound ? "bg-slate-50 text-slate-600" : "",
                      errors.roll ? "border-red-300" : "border-slate-200"
                    )}
                  />
                </Field>
              </div>
            </div>

            {/* Branch */}
            <div id="field-branch">
              <Field label="Branch" required error={errors.branch}>
                {loadingOptions ? (
                  <div className="flex items-center gap-2 h-10 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading branches…
                  </div>
                ) : (
                  <SearchableSelect
                    options={branches}
                    value={branch}
                    onChange={(id) => setBranch(id)}
                    placeholder="Select your branch"
                    disabled={profileFound}
                    error={!!errors.branch}
                  />
                )}
              </Field>
            </div>
          </section>

          {/* ── Section 2: Company & Role ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Company & Role</h2>
              <p className="text-xs text-slate-500 mt-0.5">Select the company and role you interviewed for.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div id="field-company">
                <Field label="Company" required error={errors.company}>
                  {loadingOptions ? (
                    <div className="flex items-center gap-2 h-10 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <SearchableSelect
                      options={companies}
                      value={companyId}
                      onChange={(id) => setCompanyId(id)}
                      placeholder="Search company…"
                      error={!!errors.company}
                    />
                  )}
                </Field>
              </div>

              <div id="field-role">
                <Field label="Role" required error={errors.role}>
                  {loadingOptions || loadingBuckets ? (
                    <div className="flex items-center gap-2 h-10 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {loadingBuckets ? "Loading roles…" : "Loading…"}
                    </div>
                  ) : !companyId ? (
                    <div className="flex items-center h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                      Select a company first
                    </div>
                  ) : roleBuckets.length === 0 ? (
                    <div className="flex items-center h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                      No roles configured for this company
                    </div>
                  ) : (
                    <SearchableSelect
                      options={roleBuckets.map((b) => ({ id: b.role_id, name: b.role_name }))}
                      value={roleId}
                      onChange={(id) => {
                        setRoleId(id);
                        setOfficialRole("");
                      }}
                      placeholder="Select role…"
                      error={!!errors.role}
                    />
                  )}
                </Field>
              </div>
            </div>

            {/* Official Role — shown when selected bucket has official roles */}
            {(() => {
              const selectedBucket = roleBuckets.find((b) => b.role_id === roleId);
              if (!selectedBucket || !selectedBucket.official_roles?.length) return null;
              return (
                <Field label="Official Role" hint="Select the specific role you applied for.">
                  <select
                    value={officialRole}
                    onChange={(e) => setOfficialRole(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select official role (optional)…</option>
                    {selectedBucket.official_roles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              );
            })()}
          </section>

          {/* ── Section 3: Technical Questions ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Technical Questions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Share the technical questions you were asked. Minimum <strong>4</strong> required.
              </p>
            </div>
            <div id="field-tech">
              <QuestionList
                items={techQuestions}
                onChange={setTechQuestions}
                placeholder="Describe the technical question…"
                minCount={4}
                error={errors.tech}
              />
            </div>
          </section>

          {/* ── Section 4: HR Questions ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">HR Questions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Share HR / behavioural questions you were asked. Minimum <strong>1</strong> required.
              </p>
            </div>
            <div id="field-hr">
              <QuestionList
                items={hrQuestions}
                onChange={setHrQuestions}
                placeholder="Describe the HR question…"
                minCount={1}
                error={errors.hr}
              />
            </div>
          </section>

          {/* ── Section 5: Topics ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Topics Covered</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add topics / skills that were tested. At least <strong>1</strong> required.
              </p>
            </div>
            <div id="field-topics">
              <TopicInput topics={topics} onChange={setTopics} error={errors.topics} />
            </div>
          </section>

          {/* Submit error */}
          {errors.submit && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3.5">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Submission failed</p>
                <p className="text-sm text-red-600 mt-0.5">{errors.submit}</p>
                <button
                  type="button"
                  onClick={() => setErrors((prev) => { const { submit: _, ...rest } = prev; return rest; })}
                  className="mt-2 text-xs text-red-500 underline hover:text-red-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="flex items-center justify-end gap-4 pb-4">
            <p className="text-xs text-slate-400">
              Fields marked <span className="text-red-500">*</span> are required.
            </p>
            <button
              type="submit"
              disabled={submitting || loadingOptions}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition min-w-[170px] justify-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {retryCount > 0 ? `Retrying… (${retryCount}/2)` : "Submitting…"}
                </>
              ) : (
                "Submit Experience"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
