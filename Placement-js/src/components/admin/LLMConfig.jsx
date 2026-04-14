import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getCountFromServer,
  collection,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "../../firebase";
import {
  Settings2, Key, Eye, EyeOff, Save, Play,
  CheckCircle2, AlertCircle, Loader2, RefreshCw,
  ChevronDown, Clock, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../ui/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "openai",    label: "OpenAI",           hint: "GPT-4o, GPT-4o Mini" },
  { value: "gemini",    label: "Google Gemini",     hint: "Gemini 2.0 Flash, 1.5 Pro" },
  { value: "anthropic", label: "Anthropic Claude",  hint: "Claude Sonnet, Haiku" },
  { value: "groq",      label: "Groq",              hint: "Llama 3.3, Mixtral (fast & free-tier)" },
  { value: "mistral",   label: "Mistral AI",        hint: "Mistral Large, Medium" },
];

const MODELS = {
  openai: [
    { value: "gpt-4o",           label: "GPT-4o  (Best quality)" },
    { value: "gpt-4o-mini",      label: "GPT-4o Mini  (Fast, cheap — recommended)" },
    { value: "gpt-4-turbo",      label: "GPT-4 Turbo" },
    { value: "o1-mini",          label: "o1-mini  (Reasoning, slow)" },
  ],
  gemini: [
    { value: "gemini-2.0-flash-exp",  label: "Gemini 2.0 Flash  (Recommended)" },
    { value: "gemini-1.5-pro",        label: "Gemini 1.5 Pro  (Best quality)" },
    { value: "gemini-1.5-flash",      label: "Gemini 1.5 Flash  (Fast)" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet  (Recommended)" },
    { value: "claude-3-5-haiku-latest",  label: "Claude 3.5 Haiku  (Fast, cheap)" },
    { value: "claude-3-opus-latest",     label: "Claude 3 Opus  (Most capable)" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile",  label: "Llama 3.3 70B  (Recommended)" },
    { value: "llama-3.1-8b-instant",     label: "Llama 3.1 8B  (Ultra fast)" },
    { value: "mixtral-8x7b-32768",       label: "Mixtral 8×7B" },
    { value: "gemma2-9b-it",             label: "Gemma 2 9B" },
  ],
  mistral: [
    { value: "mistral-large-latest",  label: "Mistral Large  (Best quality)" },
    { value: "mistral-medium-latest", label: "Mistral Medium" },
    { value: "mistral-small-latest",  label: "Mistral Small  (Fast, cheap)" },
  ],
};

const API_KEY_LINKS = {
  openai:    "https://platform.openai.com/api-keys",
  gemini:    "https://aistudio.google.com/app/apikey",
  anthropic: "https://console.anthropic.com/settings/keys",
  groq:      "https://console.groq.com/keys",
  mistral:   "https://console.mistral.ai/api-keys/",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtTs(ts) {
  if (!ts) return "Never";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── component ────────────────────────────────────────────────────────────────

export default function LLMConfig() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel]       = useState("gpt-4o-mini");
  const [apiKey, setApiKey]     = useState("");
  const [showKey, setShowKey]   = useState(false);

  const [saving, setSaving]         = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [pendingCount, setPendingCount] = useState(null);
  const [lastRun, setLastRun]           = useState(null);
  const [lastSummary, setLastSummary]   = useState(null);
  const [processResult, setProcessResult] = useState(null);

  // ── load existing config + status ─────────────────────────────────────────
  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const [configSnap, countSnap] = await Promise.all([
        getDoc(doc(db, "config", "llm")),
        getCountFromServer(query(
          collection(db, "raw_responses"),
          where("status", "==", "unprocessed")
        )),
      ]);

      if (configSnap.exists()) {
        const d = configSnap.data();
        if (d.provider) setProvider(d.provider);
        if (d.model)    setModel(d.model);
        if (d.apiKey)   setApiKey(d.apiKey);
        setLastRun(d.lastRun ?? null);
        setLastSummary(d.lastRunSummary ?? null);
      }
      setPendingCount(countSnap.data().count);
    } catch (err) {
      toast.error("Failed to load config: " + err.message);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  // Auto-select first model when provider changes
  const handleProviderChange = (val) => {
    setProvider(val);
    setModel(MODELS[val]?.[0]?.value ?? "");
  };

  // ── save config ───────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!provider || !model || !apiKey.trim()) {
      toast.error("Provider, model, and API key are all required.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, "config", "llm"),
        { provider, model, apiKey: apiKey.trim(), updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast.success("Configuration saved.");
    } catch (err) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── trigger processing ────────────────────────────────────────────────────
  const handleProcessNow = async () => {
    if (!apiKey.trim()) {
      toast.error("Save your API key configuration first.");
      return;
    }
    setProcessing(true);
    setProcessResult(null);
    try {
      const fns = getFunctions(app, "us-central1");
      const processNow = httpsCallable(fns, "processNow", { timeout: 300_000 }); // 5 min client timeout
      const result = await processNow();
      const data = result.data;
      setProcessResult({ success: true, data });
      setPendingCount(0);
      setLastRun(new Date());
      setLastSummary({ processed: data.processed, errors: data.errors, groupCount: data.groups?.length });
      toast.success(`Processing complete — ${data.processed} response(s) processed.`);
    } catch (err) {
      const msg = err.message?.includes("deadline-exceeded") || err.message?.includes("timeout")
        ? "The function timed out on the client but may still be running. Check back in a few minutes."
        : err.message?.includes("not-found")
        ? "Cloud Function not deployed. Deploy with: firebase deploy --only functions"
        : err.message;
      setProcessResult({ success: false, error: msg });
      toast.error("Processing failed: " + msg);
    } finally {
      setProcessing(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  const selectedProvider = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Section 1: Provider & Model Config ── */}
      <section className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-blue-500" />
            LLM Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            The selected model will be used every night at 11 PM IST to process raw student responses
            into clean interview question sets.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Provider */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Provider
            </label>
            <div className="relative">
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 py-2.5 pl-3 pr-9 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}  —  {p.hint}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Model
            </label>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 py-2.5 pl-3 pr-9 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
              >
                {(MODELS[provider] ?? []).map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                API Key
              </label>
              {selectedProvider && (
                <a
                  href={API_KEY_LINKS[provider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Get {selectedProvider.label} API key →
                </a>
              )}
            </div>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${selectedProvider?.label ?? ""} API key`}
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Stored securely in Firestore (admin-only read access).
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Configuration
          </button>
        </form>
      </section>

      {/* ── Section 2: Processing Status ── */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            Processing Status
          </h2>
          <button
            onClick={loadStatus}
            disabled={loadingStatus}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingStatus && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Pending Responses</p>
              <p className={cn(
                "text-2xl font-bold",
                pendingCount === null ? "text-slate-300" : pendingCount > 0 ? "text-amber-600" : "text-green-600"
              )}>
                {pendingCount === null ? "—" : pendingCount}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">awaiting processing</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last Run
              </p>
              <p className="text-sm font-semibold text-slate-700">{fmtTs(lastRun)}</p>
              {lastSummary && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {lastSummary.processed ?? 0} processed · {lastSummary.errors ?? 0} errors
                </p>
              )}
            </div>
          </div>

          {/* Schedule info */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
            <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Automatic processing runs every night at <strong>11:00 PM IST</strong> via the
              deployed Cloud Function.
            </p>
          </div>

          {/* Last run summary detail */}
          {lastSummary?.groups?.length > 0 && (
            <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
              <p className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200">
                Last run — group details
              </p>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                {lastSummary.groups.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2">
                    {g.status === "success"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      : <AlertCircle  className="h-3.5 w-3.5 text-red-500   shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{g.label}</p>
                      {g.error
                        ? <p className="text-xs text-red-500">{g.error}</p>
                        : <p className="text-xs text-slate-400">{g.responses} response(s) processed</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Manual Trigger ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Play className="h-4 w-4 text-green-500" />
            Manual Processing
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Process all pending responses right now without waiting for the nightly schedule.
            Requires the Cloud Function to be deployed.
          </p>
        </div>

        {/* Process now button */}
        <button
          onClick={handleProcessNow}
          disabled={processing || !apiKey.trim()}
          className={cn(
            "flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition",
            processing || !apiKey.trim()
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700 shadow-sm"
          )}
        >
          {processing
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
            : <><Play className="h-4 w-4" /> Process Now</>
          }
        </button>

        {processing && (
          <p className="text-xs text-slate-400 animate-pulse">
            Calling LLM for each company+role group… this may take 1–5 minutes.
          </p>
        )}

        {/* Result banner */}
        {processResult && (
          <div className={cn(
            "rounded-xl border p-4 flex items-start gap-3",
            processResult.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          )}>
            {processResult.success
              ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              : <AlertCircle  className="h-5 w-5 text-red-500   shrink-0" />
            }
            <div>
              {processResult.success ? (
                <>
                  <p className="text-sm font-semibold text-green-800">Processing complete</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {processResult.data?.processed ?? 0} response(s) processed across{" "}
                    {processResult.data?.groups?.length ?? 0} company/role group(s).
                    {processResult.data?.errors > 0 && ` ${processResult.data.errors} error(s).`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-800">Processing failed</p>
                  <p className="text-xs text-red-700 mt-0.5">{processResult.error}</p>
                  {processResult.error?.includes("not deployed") && (
                    <p className="text-xs text-red-600 mt-1 font-mono bg-red-100 rounded px-2 py-1 mt-2">
                      firebase deploy --only functions
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Deploy reminder */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-700">Deploy Cloud Functions</p>
          <p className="text-xs text-slate-500">
            Both manual trigger and nightly schedule require the functions to be deployed:
          </p>
          <code className="block text-xs bg-slate-800 text-green-300 rounded px-3 py-2 mt-2 font-mono">
            cd functions && npm install{"\n"}firebase deploy --only functions
          </code>
        </div>
      </section>
    </div>
  );
}
