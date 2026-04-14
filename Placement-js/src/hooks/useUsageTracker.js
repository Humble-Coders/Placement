/**
 * useUsageTracker
 *
 * Tracks "active time" (tab visible, not just open) for authenticated students.
 *
 * Write strategy (low-write):
 *  – Counts seconds only while document.visibilityState === "visible"
 *  – Flushes (writes to Firestore) on:
 *      1. Tab goes hidden (visibilitychange) — most reliable
 *      2. Page unload (beforeunload) — best-effort
 *      3. Every 5 minutes while active — safety net
 *      4. Component unmount (sign-out) — cleanup
 *  – Writes two docs per flush:
 *      usage/{uid}                — summary: totalMinutes, lastSeen, email, branch
 *      usage/{uid}/daily/{date}   — daily:   minutes for that date
 *  – Both use FieldValue.increment() so concurrent sessions or retries are safe
 */

import { useEffect, useRef } from "react";
import {
  doc,
  setDoc,
  getDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function sanitizeEmail(email) {
  return email.toLowerCase().replace(/[.#$[\]]/g, "_");
}

export function useUsageTracker(user, role) {
  // useRef holds mutable timer state without triggering re-renders
  const t = useRef({
    visibleSince: null,  // ms timestamp when tab became active; null if inactive
    accSeconds: 0,       // seconds accumulated since last flush
    uid: null,
    email: null,
    branch: null,
    today: null,
    flushing: false,
  });

  useEffect(() => {
    // Only track authenticated students; skip if Firebase isn't configured
    if (!user || role !== "student" || !db) return;

    // ── Initialise state for this session ─────────────────────────────────
    const s = t.current;
    s.uid = user.uid;
    s.email = user.email.toLowerCase();
    s.branch = null;
    s.accSeconds = 0;
    s.flushing = false;
    s.today = getTodayUTC();

    // Start timing if the tab is already visible
    s.visibleSince = document.visibilityState === "visible" ? Date.now() : null;

    // Fetch branch info from student profile (one read per session, best-effort)
    getDoc(doc(db, "students", sanitizeEmail(s.email)))
      .then((snap) => {
        if (snap.exists()) s.branch = snap.data().branch ?? null;
      })
      .catch(() => {/* branch stays null — no problem */});

    // ── Core flush function ───────────────────────────────────────────────
    const flush = async () => {
      if (s.flushing) return;

      // Snapshot the currently-running visible stretch
      if (s.visibleSince !== null) {
        s.accSeconds += (Date.now() - s.visibleSince) / 1000;
        s.visibleSince = null; // pause; re-arm only when tab is visible again
      }

      const minutes = Math.floor(s.accSeconds / 60);
      if (minutes < 1) return; // nothing worth writing

      s.accSeconds = s.accSeconds % 60; // carry the sub-minute remainder
      s.flushing = true;

      const date = s.today;
      const uid = s.uid;

      try {
        // Summary doc (totalMinutes is atomic increment — safe from any device)
        const summaryPayload = {
          uid,
          email: s.email,
          totalMinutes: increment(minutes),
          lastSeen: serverTimestamp(),
        };
        if (s.branch) summaryPayload.branch = s.branch;

        // Daily doc — the ground truth for per-day breakdowns
        await Promise.all([
          setDoc(doc(db, "usage", uid), summaryPayload, { merge: true }),
          setDoc(
            doc(db, "usage", uid, "daily", date),
            {
              date,
              minutes: increment(minutes),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
        ]);
      } catch (err) {
        // Restore seconds so they're not lost on retry
        s.accSeconds += minutes * 60;
        if (import.meta.env.DEV) console.warn("[tracker] flush failed:", err.message);
      } finally {
        s.flushing = false;
      }
    };

    // ── Event handlers ────────────────────────────────────────────────────
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Tab became active — start/resume timer, refresh date in case day rolled over
        s.visibleSince = Date.now();
        s.today = getTodayUTC();
      } else {
        // Tab went to background — flush immediately (most reliable write path)
        flush();
      }
    };

    // Periodic mid-session flush (5 min): ensures we capture partial sessions
    // even if the tab is never backgrounded (student keeps it fullscreen)
    const onInterval = () => {
      if (document.visibilityState !== "visible" || s.visibleSince === null) return;
      // Snapshot elapsed time but restart the visible timer
      const now = Date.now();
      s.accSeconds += (now - s.visibleSince) / 1000;
      s.visibleSince = now;
      flush();
    };

    // beforeunload: best-effort (browser may not wait for async)
    // visibilitychange (above) already fires before most closes so this is a
    // secondary safety net
    const onUnload = () => {
      if (s.visibleSince !== null) {
        s.accSeconds += (Date.now() - s.visibleSince) / 1000;
        s.visibleSince = null;
      }
      flush(); // async, may not complete — that's acceptable
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    const intervalId = setInterval(onInterval, 5 * 60 * 1000);

    // ── Cleanup (fires on sign-out / role change) ─────────────────────────
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      clearInterval(intervalId);

      // Final flush — student navigated away or signed out
      if (s.visibleSince !== null) {
        s.accSeconds += (Date.now() - s.visibleSince) / 1000;
        s.visibleSince = null;
      }
      flush();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, role]);
}
