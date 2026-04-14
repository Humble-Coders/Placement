/* eslint-disable */
"use strict";

/**
 * Builds the LLM prompt for processing raw student interview responses
 * for a specific company + role combination.
 */
function buildPrompt({
  companyName,
  roleName,
  rawTech,
  rawHr,
  rawTopics,
  existingTech,
  existingHr,
  existingAdditional,
}) {
  const techList = rawTech.length
    ? rawTech.map((q, i) => `  ${i + 1}. ${q}`).join("\n")
    : "  (none submitted)";

  const hrList = rawHr.length
    ? rawHr.map((q, i) => `  ${i + 1}. ${q}`).join("\n")
    : "  (none submitted)";

  const topicsLine = rawTopics.length
    ? rawTopics.join(", ")
    : "Not specified";

  const existingSection = (existingTech.length > 0 || existingHr.length > 0)
    ? `
## ⚠️  ALREADY IN THE QUESTION BANK — DO NOT REPEAT THESE
These questions are already documented. Any new question you return must NOT be a duplicate or paraphrase of these.

### Existing Technical Questions (${existingTech.length})
${existingTech.map((q, i) => `  ${i + 1}. ${q}`).join("\n") || "  (none)"}

### Existing HR Questions (${existingHr.length})
${existingHr.map((q, i) => `  ${i + 1}. ${q}`).join("\n") || "  (none)"}

### Existing Additional Practice Questions (${existingAdditional.length})
${existingAdditional.map((q, i) => `  ${i + 1}. ${q}`).join("\n") || "  (none)"}
`
    : "\n## No existing questions in the bank yet — this is a fresh entry.\n";

  return `You are an expert placement preparation assistant for engineering students at Thapar University, India.

## Mission
Process raw interview experience submissions from students who have recently interviewed at **${companyName}** for the **${roleName}** role.
Your goal: produce a clean, deduplicated, high-quality question bank that helps future students prepare effectively.

## Context
- Company: ${companyName}
- Role: ${roleName}
- Topics/Skills mentioned by students: ${topicsLine}

## Raw Student Submissions

### Technical Questions Submitted (${rawTech.length} entries — may contain duplicates, typos, or vague phrasing)
${techList}

### HR / Behavioral Questions Submitted (${rawHr.length} entries)
${hrList}
${existingSection}
---

## Your Four Tasks

### Task 1 — Clean & Deduplicate Technical Questions
Rules:
- Rewrite each raw question as a clear, complete, self-contained question
- Fix typos, grammar errors, and ambiguous phrasing
- Merge near-duplicate or very similar questions into the single best version
- SKIP any question that is already present in "Existing Technical Questions" above
- Do NOT invent new questions here — only clean the raw submissions
- If raw submissions are empty, return an empty array

### Task 2 — Clean & Deduplicate HR Questions
Apply the same process as Task 1 but for HR / behavioral questions.
- Skip duplicates of "Existing HR Questions"
- Keep authentic student-reported behavioral questions about teamwork, conflict, motivation, etc.

### Task 3 — Generate Exactly 8 Additional Practice Questions
These are AI-generated practice questions to supplement the real interview questions.

Strict requirements:
- Exactly 8 questions — no more, no fewer
- Target level: final/pre-final year college student applying for internship or entry-level job (NOT senior engineer, NOT system design at scale)
- Base questions on the role (${roleName}), company (${companyName}), and topics mentioned
- Mix: 2–3 data structures/algorithms, 2–3 technical conceptual questions, 1–2 aptitude or problem-solving
- Must NOT duplicate any existing, cleaned, or real questions
- Each question must be self-contained and answerable in a 15–20 minute interview slot
- Focus on what's actually tested in campus placement drives

### Task 4 — Extract & Normalize Topics/Skills
From all questions and raw topic mentions, compile a clean skills list:
- Use proper capitalized names (e.g., "Dynamic Programming" not "dp", "Object-Oriented Programming" not "oops")
- Include only genuine technical skills/topics (not soft skills)
- Deduplicate
- Keep it concise (10–20 items max)

---

## Output Format
Respond with ONLY a valid JSON object. Absolutely no markdown fences, no explanatory text, no trailing comments — just the raw JSON.

{
  "technical_questions": [
    "Cleaned question from raw submissions (only new ones not already in bank)...",
    "..."
  ],
  "hr_questions": [
    "Cleaned HR question...",
    "..."
  ],
  "additional_questions": [
    "Practice question 1 (exactly 8 total)...",
    "Practice question 2...",
    "Practice question 3...",
    "Practice question 4...",
    "Practice question 5...",
    "Practice question 6...",
    "Practice question 7...",
    "Practice question 8..."
  ],
  "topics": [
    "Skill1",
    "Skill2",
    "..."
  ]
}`;
}

module.exports = { buildPrompt };
