/* eslint-disable */
/**
 * HumblePrep — Firebase Cloud Functions (v2)
 *
 * Setup:
 *   1. npm install -g firebase-tools
 *   2. firebase login
 *   3. firebase init functions  (choose existing project, Node 20, JavaScript)
 *   4. Copy this directory into the generated functions/ folder
 *   5. cd functions && npm install
 *   6. firebase deploy --only functions
 *
 * Functions exported:
 *   processNightly  — Scheduled: runs at 11 PM IST every night
 *   processNow      — HTTPS Callable: admin can trigger manually from the dashboard
 *   onDailyUsageWrite — Firestore trigger: updates usage summary + streak (from prior impl)
 */

const { onSchedule }              = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError }      = require("firebase-functions/v2/https");
const { onDocumentWritten }       = require("firebase-functions/v2/firestore");
const { initializeApp }           = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { runProcessing }           = require("./processResponses");

initializeApp();

// ─── Function options ──────────────────────────────────────────────────────

// Scheduled functions: hard limit is 1800 s (30 min).
const SCHEDULED_OPTIONS = {
  timeoutSeconds: 1800,
  memory: "1GiB",
  region: "us-central1",
};

// HTTPS callable functions: hard limit is 3600 s (60 min).
const CALLABLE_OPTIONS = {
  timeoutSeconds: 3600,
  memory: "1GiB",
  region: "us-central1",
};

// ─── Nightly scheduled function ───────────────────────────────────────────

/**
 * Runs every night at 11:00 PM IST (17:30 UTC).
 * Processes all unprocessed raw_responses and updates the questions collection.
 */
exports.processNightly = onSchedule(
  {
    ...SCHEDULED_OPTIONS,
    schedule: "30 17 * * *",   // cron: 5:30 PM UTC = 11:00 PM IST
    timeZone: "UTC",
  },
  async () => {
    const db = getFirestore();
    console.log("[processNightly] Starting nightly processing…");
    try {
      const result = await runProcessing(db);
      console.log("[processNightly] Complete:", JSON.stringify(result));
    } catch (err) {
      console.error("[processNightly] Fatal error:", err.message);
      // Record the failure in config so admin can see it
      try {
        await db.collection("config").doc("llm").update({
          lastRun: FieldValue.serverTimestamp(),
          lastRunSummary: { error: err.message, processed: 0, errors: 1 },
        });
      } catch {}
    }
  }
);

// ─── Admin-triggered callable ─────────────────────────────────────────────

/**
 * Called from the Admin Dashboard "Process Now" button.
 * Verifies the caller is an admin, then runs the same processing pipeline.
 */
exports.processNow = onCall(
  {
    ...CALLABLE_OPTIONS,
    cors: true,
  },
  async (request) => {
    const db = getFirestore();

    // Auth check
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    // Role check — only admins
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    console.log(`[processNow] Triggered by admin ${uid}`);
    try {
      const result = await runProcessing(db);
      return result;
    } catch (err) {
      console.error("[processNow] Error:", err.message);
      throw new HttpsError("internal", err.message);
    }
  }
);

// ─── Usage streak updater (from usage tracking feature) ───────────────────

/**
 * Whenever a daily usage doc changes, recalculate totalMinutes and streak
 * on the parent summary doc. This provides ground-truth data for the Stats panel.
 */
exports.onDailyUsageWrite = onDocumentWritten(
  {
    document: "usage/{uid}/daily/{date}",
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const db  = getFirestore();
    const uid = event.params.uid;

    const dailySnap = await db
      .collection("usage")
      .doc(uid)
      .collection("daily")
      .get();

    const activeDocs = dailySnap.docs
      .map((d) => d.data())
      .filter((d) => (d.minutes ?? 0) > 0);

    const totalMinutes = activeDocs.reduce((s, d) => s + (d.minutes ?? 0), 0);

    // Streak: count consecutive days ending today or yesterday
    const activeDates = new Set(activeDocs.map((d) => d.date));
    let streak = 0;
    const cursor = new Date();

    for (let i = 0; i < 365; i++) {
      const iso = cursor.toISOString().slice(0, 10);
      if (activeDates.has(iso)) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else if (i === 0) {
        // Today has no activity — check from yesterday
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (!activeDates.has(cursor.toISOString().slice(0, 10))) break;
      } else {
        break;
      }
    }

    await db.collection("usage").doc(uid).set(
      { totalMinutes, streak, lastSeen: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
);
