import { useEffect, useRef, useState } from "react";
import { BookOpen, Mail, RefreshCw, LogOut, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const RESEND_COOLDOWN = 60; // seconds

function getResendCooldownRemaining(email) {
  try {
    const key = `verif_resent_${email}`;
    const ts = Number(localStorage.getItem(key) ?? 0);
    const elapsed = Math.floor((Date.now() - ts) / 1000);
    return Math.max(0, RESEND_COOLDOWN - elapsed);
  } catch {
    return 0;
  }
}

function markResent(email) {
  try {
    localStorage.setItem(`verif_resent_${email}`, String(Date.now()));
  } catch {}
}

export default function EmailVerificationPage() {
  const { user, signOut, resendVerification, reloadUser } = useAuth();
  const email = user?.email ?? "";

  const [cooldown, setCooldown]     = useState(() => getResendCooldownRemaining(email));
  const [resending, setResending]   = useState(false);
  const [checking, setChecking]     = useState(false);
  const [resendMsg, setResendMsg]   = useState("");
  const [checkMsg, setCheckMsg]     = useState("");
  const pollRef                     = useRef(null);

  // Countdown tick
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Auto-poll: silently reload user every 5 s and let App.jsx re-route on success
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        await reloadUser();
      } catch {}
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [reloadUser]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendMsg("");
    try {
      await resendVerification();
      markResent(email);
      setCooldown(RESEND_COOLDOWN);
      setResendMsg("Verification email sent! Check your inbox (and spam folder).");
    } catch (err) {
      setResendMsg(
        err.code === "auth/too-many-requests"
          ? "Too many requests — please wait a few minutes before trying again."
          : `Failed to resend: ${err.message}`
      );
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    if (checking) return;
    setChecking(true);
    setCheckMsg("");
    try {
      await reloadUser();
      // App.jsx watches user.emailVerified and will re-route automatically.
      // If we're still here after reload, verification hasn't happened yet.
      setCheckMsg("Not verified yet. Please click the link in your email first.");
    } catch {
      setCheckMsg("Could not refresh. Check your internet connection.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4">
      {/* Card */}
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl shadow-slate-100 p-8 flex flex-col items-center gap-6">

        {/* Logo + icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">HumblePrep</h1>
        </div>

        {/* Mail illustration */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 border-4 border-blue-100">
          <Mail className="h-9 w-9 text-blue-500" />
        </div>

        {/* Heading */}
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900">Verify your email</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            We sent a verification link to
          </p>
          <p className="text-sm font-semibold text-blue-600 break-all">{email}</p>
          <p className="text-sm text-slate-500 leading-relaxed">
            Click the link in that email to activate your account.
          </p>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-slate-100" />

        {/* Check now button */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {checking
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
              : <><CheckCircle2 className="h-4 w-4" /> I've verified — continue</>
            }
          </button>

          {checkMsg && (
            <p className="text-center text-xs text-slate-500">{checkMsg}</p>
          )}

          {/* Auto-poll notice */}
          <p className="text-center text-xs text-slate-400">
            The page also checks automatically every few seconds.
          </p>
        </div>

        {/* Resend */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {resending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : cooldown > 0
                ? <><RefreshCw className="h-4 w-4" /> Resend email ({cooldown}s)</>
                : <><RefreshCw className="h-4 w-4" /> Resend verification email</>
            }
          </button>

          {resendMsg && (
            <p className={`text-center text-xs ${resendMsg.startsWith("Verification") ? "text-green-600" : "text-red-500"}`}>
              {resendMsg}
            </p>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Wrong account? Sign out
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Didn&apos;t get the email? Check your spam folder first.
      </p>
    </div>
  );
}
