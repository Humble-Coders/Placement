/* eslint-disable */
"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { callLLM } = require("./llm");
const { buildPrompt } = require("./prompt");

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Merge two arrays, deduplicate by lowercased value. */
function mergeDedup(existing = [], incoming = []) {
  const seen = new Set(existing.map((s) => s.toLowerCase().trim()));
  const merged = [...existing];
  for (const item of incoming) {
    const key = item.toLowerCase().trim();
    if (item.trim() && !seen.has(key)) {
      seen.add(key);
      merged.push(item.trim());
    }
  }
  return merged;
}

/** Commit a Firestore batch, automatically splitting if >400 ops. */
async function commitBatch(db, ops) {
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    ops.slice(i, i + CHUNK).forEach(({ ref, data, method }) => {
      if (method === "update") batch.update(ref, data);
      else batch.set(ref, data, { merge: true });
    });
    await batch.commit();
  }
}

// ─── Core: process one company+role group ─────────────────────────────────────

async function processGroup(db, group, llmConfig) {
  const {
    company_id, company_name,
    role_id, role_name,
    responses, docIds,
  } = group;

  // 1. Collect raw data from all responses
  const rawTech    = [];
  const rawHr      = [];
  const rawTopics  = [];
  const branches   = new Set();

  for (const r of responses) {
    rawTech.push(...(r.technical_questions ?? []));
    rawHr.push(...(r.hr_questions ?? []));
    rawTopics.push(...(r.topics ?? []));
    if (r.branch) branches.add(r.branch);
  }

  // 2. Look up existing questions document
  const existingSnap = await db
    .collection("questions")
    .where("company_id", "==", company_id)
    .where("role_id",   "==", role_id)
    .limit(1)
    .get();

  const existingDoc  = existingSnap.empty ? null : existingSnap.docs[0];
  const existing     = existingDoc?.data() ?? {};

  console.log(
    `[process] ${company_name} / ${role_name}: ${rawTech.length} tech, ${rawHr.length} HR, ` +
    `${responses.length} responses, existing=${!existingSnap.empty}`
  );

  // 3. Build prompt and call LLM
  const prompt = buildPrompt({
    companyName:        company_name,
    roleName:           role_name,
    rawTech,
    rawHr,
    rawTopics,
    existingTech:       existing.technical_questions   ?? [],
    existingHr:         existing.hr_questions          ?? [],
    existingAdditional: existing.additional_questions  ?? [],
  });

  const llmResult = await callLLM({ ...llmConfig, prompt });

  // 4. Validate and normalise LLM output
  const newTech        = Array.isArray(llmResult.technical_questions)  ? llmResult.technical_questions  : [];
  const newHr          = Array.isArray(llmResult.hr_questions)         ? llmResult.hr_questions         : [];
  const additionalQs   = (Array.isArray(llmResult.additional_questions) ? llmResult.additional_questions : []).slice(0, 8);
  const cleanTopics    = Array.isArray(llmResult.topics)               ? llmResult.topics               : [];

  // 5. Merge with existing (dedup by lowercase comparison)
  const mergedTech   = mergeDedup(existing.technical_questions  ?? [], newTech);
  const mergedHr     = mergeDedup(existing.hr_questions         ?? [], newHr);
  const mergedTopics = mergeDedup(existing.topics               ?? [], cleanTopics);
  const mergedBranches = [...new Set([...(existing.branches ?? []), ...branches])];

  // 6. Write merged document to /questions (upsert)
  const questionData = {
    company_id,
    company_name,
    role_id,
    role_name,
    technical_questions:  mergedTech,
    hr_questions:         mergedHr,
    additional_questions: additionalQs,  // replaced each run (fresh 8 practice questions)
    topics:               mergedTopics,
    branches:             mergedBranches,
    // Preserve existing fields we don't touch
    hiring_status:        existing.hiring_status   ?? "",
    official_branches:    existing.official_branches ?? [],
    role_labels:          existing.role_labels      ?? [],
    official_roles:       existing.official_roles   ?? [],
    // Metadata
    lastProcessed:        FieldValue.serverTimestamp(),
    processedCount:       (existing.processedCount ?? 0) + responses.length,
  };

  if (existingDoc) {
    await existingDoc.ref.update(questionData);
  } else {
    await db.collection("questions").add(questionData);
  }

  // 7. Mark all raw_responses for this group as processed
  const batchOps = docIds.map((id) => ({
    ref:    db.collection("raw_responses").doc(id),
    method: "update",
    data:   { status: "processed", processedAt: FieldValue.serverTimestamp() },
  }));
  await commitBatch(db, batchOps);

  console.log(
    `[process] ✓ ${company_name}/${role_name}: ` +
    `+${newTech.length} tech, +${newHr.length} HR, ${additionalQs.length} additional, ` +
    `marked ${docIds.length} responses processed`
  );

  return {
    company_name, role_name,
    addedTech:    newTech.length,
    addedHr:      newHr.length,
    responses:    responses.length,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Fetches all unprocessed raw_responses, groups by company+role,
 * calls the LLM for each group, and writes the results to /questions.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @returns {Promise<object>} summary of processing results
 */
async function runProcessing(db) {
  // 1. Load LLM config
  const configSnap = await db.collection("config").doc("llm").get();
  if (!configSnap.exists) {
    throw new Error("LLM configuration not set. Please configure it in the Admin → Config tab.");
  }
  const { provider, model, apiKey } = configSnap.data();
  if (!provider || !model || !apiKey) {
    throw new Error("LLM config is incomplete (provider, model, and apiKey are required).");
  }

  // 2. Fetch all unprocessed responses
  const responsesSnap = await db
    .collection("raw_responses")
    .where("status", "==", "unprocessed")
    .get();

  if (responsesSnap.empty) {
    console.log("[process] No unprocessed responses. Done.");
    return { processed: 0, errors: 0, skipped: 0, groups: [], message: "No pending responses." };
  }

  console.log(`[process] Found ${responsesSnap.size} unprocessed responses.`);

  // 3. Group by (company_id, role_id)
  const groupMap = new Map();
  for (const doc of responsesSnap.docs) {
    const d = doc.data();
    if (!d.company_id || !d.role_id) {
      console.warn(`[process] Skipping response ${doc.id} — missing company_id or role_id`);
      continue;
    }
    const key = `${d.company_id}__${d.role_id}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        company_id:   d.company_id,
        company_name: d.company_name ?? "Unknown Company",
        role_id:      d.role_id,
        role_name:    d.role_name    ?? "Unknown Role",
        responses:    [],
        docIds:       [],
      });
    }
    const grp = groupMap.get(key);
    grp.responses.push(d);
    grp.docIds.push(doc.id);
  }

  const groups  = [...groupMap.values()];
  const summary = { processed: 0, errors: 0, groups: [] };

  console.log(`[process] Processing ${groups.length} company+role group(s)…`);

  // 4. Process each group sequentially (respect rate limits, avoid partial failures)
  for (const group of groups) {
    const label = `${group.company_name} / ${group.role_name}`;
    try {
      const result = await processGroup(db, group, { provider, model, apiKey });
      summary.processed += group.docIds.length;
      summary.groups.push({ label, status: "success", ...result });
      console.log(`[process] ✅ ${label}`);
    } catch (err) {
      summary.errors++;
      summary.groups.push({ label, status: "error", error: err.message });
      console.error(`[process] ❌ ${label}: ${err.message}`);
    }

    // Small delay between groups to avoid LLM rate limits
    if (groups.indexOf(group) < groups.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // 5. Update last-run metadata in config
  await db.collection("config").doc("llm").update({
    lastRun:        FieldValue.serverTimestamp(),
    lastRunSummary: {
      processed:  summary.processed,
      errors:     summary.errors,
      groupCount: summary.groups.length,
      groups:     summary.groups.map((g) => ({
        label:  g.label,
        status: g.status,
        ...(g.error ? { error: g.error } : { responses: g.responses }),
      })),
    },
  });

  console.log(`[process] Done. Processed ${summary.processed} responses, ${summary.errors} errors.`);
  return summary;
}

module.exports = { runProcessing };
