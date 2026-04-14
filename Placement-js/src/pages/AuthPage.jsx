import { useState } from "react";
import { BookOpen, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

function PasswordInput({ value, onChange, placeholder = "Password" }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        minLength={6}
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none ring-0 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === "signup";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.toLowerCase().endsWith("@thapar.edu")) {
      setError("Only @thapar.edu email addresses are allowed.");
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        toast.success("Account created! Welcome to HumblePrep.");
      } else {
        await signIn(email, password);
        toast.success("Signed in successfully.");
      }
    } catch (err) {
      const msg = friendlyError(err.code ?? err.message);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-100 mb-4">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">HumblePrep</h1>
          <p className="text-sm text-slate-500 mt-1">Placement Interview Portal · Thapar University</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab toggle */}
          <div className="flex border-b border-slate-200">
            {["signin", "signup"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/40"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide">
                Thapar Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@thapar.edu"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide">
                Password
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? "Create a password" : "Your password"}
              />
            </div>

            {/* Confirm password (signup only) */}
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Confirm Password
                </label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </button>

            {/* Hint */}
            <p className="text-center text-xs text-slate-400">
              {isSignUp
                ? "Already have an account? "
                : "Don't have an account? "}
              <button
                type="button"
                onClick={() => { setMode(isSignUp ? "signin" : "signup"); setError(""); }}
                className="text-blue-600 font-medium hover:underline"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Access restricted to Thapar University students &amp; staff.
        </p>
      </div>
    </div>
  );
}

function friendlyError(code) {
  const map = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many failed attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}
