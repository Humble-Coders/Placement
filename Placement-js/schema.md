# HumblePrep — Firestore Schema

> Last updated: 2026-04-14 (v4 — LLM nightly processing + config)

---

## Authentication

Firebase Authentication with **email/password** provider.

- Only `@thapar.edu` email addresses may register or sign in (enforced on the client and in Firestore rules via `request.auth.token.email`).
- Two roles: **`admin`** and **`student`** (stored in `/users/{uid}`).
- Admin accounts must be created manually (via Firebase Console or a seed script) by setting `role: "admin"` in the Firestore `users` document.

---

## Collections

### `users/{uid}`

Created automatically on **Sign Up**. Document ID = Firebase Auth UID.

| Field       | Type        | Description                                          |
|-------------|-------------|------------------------------------------------------|
| `email`     | `string`    | Lowercase `@thapar.edu` email                        |
| `role`      | `string`    | `"student"` or `"admin"`                             |
| `createdAt` | `Timestamp` | Account creation time                                |
| `lastLogin` | `Timestamp` | Updated on every successful sign-in                  |

**Rules summary:**
- Owner can read their own document.
- Admins can read all documents.
- `role` may only be set to `"student"` on creation; only admins can change it later.

---

### `students/{docId}`

Populated by admin via Excel upload. Document ID = email with `@`, `.` replaced by `_`.

| Field       | Type        | Description                                          |
|-------------|-------------|------------------------------------------------------|
| `name`      | `string`    | Full name of the student                             |
| `roll`      | `string`    | Roll number                                          |
| `email`     | `string`    | Lowercase `@thapar.edu` email (used for lookup)      |
| `branch`    | `string`    | Academic branch (e.g. `"CSE"`, `"ECE"`)              |
| `updatedAt` | `Timestamp` | Last upload/update timestamp                         |

**Rules summary:**
- Admins have full read/write access.
- Students can only read the document where `email == request.auth.token.email`.

---

### `companies/{id}`

One document per company. Document ID = Firestore auto-ID.

| Field       | Type        | Description                     |
|-------------|-------------|----------------------------------|
| `name`      | `string`    | Company name (e.g. `"Google"`)  |
| `createdAt` | `Timestamp` | When the company was added       |

**Rules summary:**
- Any authenticated Thapar user can read.
- Only admins can create / update / delete.

---

### `roles/{id}`

One document per role category. Document ID = Firestore auto-ID.

| Field       | Type        | Description                               |
|-------------|-------------|-------------------------------------------|
| `name`      | `string`    | Role name (e.g. `"Software Engineer"`)    |
| `createdAt` | `Timestamp` | When the role was added                   |

**Rules summary:** Same as `companies`.

---

### `questions/{id}`

One document per placement interview experience. Document ID = Firestore auto-ID.

| Field                | Type       | Description                                                         |
|----------------------|------------|---------------------------------------------------------------------|
| `company_id`         | `string`   | Reference to `companies/{id}`                                       |
| `role_id`            | `string`   | Reference to `roles/{id}`                                           |
| `company_name`       | `string`   | Denormalized company name                                           |
| `role_name`          | `string`   | Denormalized role name                                              |
| `branches`           | `string[]` | Branches that experienced this (e.g. `["CSE", "ECE"]`)             |
| `official_branches`  | `string[]` | Branches officially eligible                                        |
| `role_labels`        | `string[]` | Display labels for the role                                         |
| `official_roles`     | `string[]` | Official role names                                                 |
| `hiring_status`      | `string`   | `"I"` (intern), `"FT"` (full-time), or `"I+FT"`                   |
| `technical_questions`| `string[]` | Technical interview questions shared by students                    |
| `hr_questions`       | `string[]` | HR round questions                                                  |
| `additional_questions`| `string[]`| Other round questions                                               |
| `topics`             | `string[]` | Topics/skills tested                                                |

**Rules summary:** Any authenticated Thapar user can read. Only admins can write.

---

### `branches/{id}`

One document per academic branch. Document ID = Firestore auto-ID.
Managed by admins via the Branches tab in the Admin Dashboard.

| Field       | Type        | Description                       |
|-------------|-------------|-----------------------------------|
| `name`      | `string`    | Branch name (e.g. `"CSE"`, `"ECE"`) |
| `createdAt` | `Timestamp` | When the branch was added         |

**Rules summary:** **Publicly readable** (required by student form dropdown). Only admins can write.

---

### `raw_responses/{id}`

One document per student form submission. Document ID = Firestore auto-ID.
Submitted via the public `/form` page (no auth required).

| Field                 | Type        | Description                                           |
|-----------------------|-------------|-------------------------------------------------------|
| `email`               | `string`    | Student's `@thapar.edu` email                         |
| `name`                | `string`    | Student's full name                                   |
| `roll`                | `string`    | Roll number                                           |
| `branch`              | `string`    | Branch name (denormalized from `branches` collection) |
| `company_id`          | `string`    | Reference to `companies/{id}`                         |
| `company_name`        | `string`    | Denormalized company name                             |
| `role_id`             | `string`    | Reference to `roles/{id}`                             |
| `role_name`           | `string`    | Denormalized role name                                |
| `technical_questions` | `string[]`  | Technical questions (minimum 4)                       |
| `hr_questions`        | `string[]`  | HR questions (minimum 1)                              |
| `topics`              | `string[]`  | Topics/skills covered (minimum 1)                     |
| `status`              | `string`    | Always `"unprocessed"` on creation                    |
| `submittedAt`         | `Timestamp` | Submission time                                       |

**Rules summary:** Anyone (unauthenticated) can **create** a document. Only admins can read, update, or delete.

---

### `submissionLocks/{lockId}`

Deduplication guard for the student form. Written atomically inside the same
Firestore transaction that creates the `raw_responses` document.

Document ID (lockId) = `sanitizedEmail_companyId_roleId`  
e.g. `101903001_thapar_edu_companyXYZ_roleABC`

| Field         | Type        | Description                                       |
|---------------|-------------|---------------------------------------------------|
| `email`       | `string`    | Student email (normalised, lowercase)             |
| `companyId`   | `string`    | Company document ID                               |
| `roleId`      | `string`    | Role document ID                                  |
| `responseId`  | `string`    | The `raw_responses` document ID created alongside |
| `submittedAt` | `Timestamp` | When the lock was last written                    |

**Rules summary:** Publicly readable and writable (required for the unauthenticated
form transaction to both read the existing lock and write the new one atomically).  
Re-submissions within **24 hours** are rejected client-side before any Firestore
write is attempted.

---

---

## Student Form (`/form`)

A **public page** (no sign-in required) at `/form`. Students fill in:
- Their Thapar email → triggers profile autofill from `students` collection
- Name, roll number, branch (pre-filled if profile exists; editable otherwise)
- Company (searchable dropdown, only existing `companies` docs)
- Role (searchable dropdown, only existing `roles` docs)
- Technical questions (min 4, dynamic add/remove list)
- HR questions (min 1, dynamic add/remove list)
- Topics (tag input, min 1, add via Enter or button)

On submit, a document is written to `raw_responses` with `status: "unprocessed"`.

The form is accessible from the student portal header via **Share Experience** button.

---

---

### `usage/{uid}`

Created automatically on first session flush. Document ID = Firebase Auth UID.
Written by the client tracker (`useUsageTracker` hook) using atomic `increment()`.

| Field          | Type        | Description                                           |
|----------------|-------------|-------------------------------------------------------|
| `uid`          | `string`    | Firebase Auth UID                                     |
| `email`        | `string`    | Student's email (copied from auth)                    |
| `branch`       | `string`    | Branch (fetched from `students` profile on session start) |
| `totalMinutes` | `number`    | Cumulative active minutes (atomic increment)          |
| `streak`       | `number`    | Current consecutive day streak (set by Cloud Function) |
| `lastSeen`     | `Timestamp` | Server timestamp of last flush                        |

**Rules summary:** Students can create/update their own doc (UID-gated). Admins can read all docs (needed for Stats panel collection-level query).

---

### `usage/{uid}/daily/{date}`

One document per calendar day. Document ID = `"YYYY-MM-DD"` (UTC date).

| Field       | Type        | Description                              |
|-------------|-------------|------------------------------------------|
| `date`      | `string`    | `"YYYY-MM-DD"` UTC date                  |
| `minutes`   | `number`    | Active minutes that day (atomic increment) |
| `updatedAt` | `Timestamp` | Last write timestamp                     |

**Rules summary:** Students write their own subcollection. Admins can read all daily docs (used for individual student activity chart, expandable in the Stats panel).

---

---

### `config/llm`

Single document storing LLM provider config and last-run metadata.
Document ID is always `"llm"`.

| Field           | Type        | Description                                              |
|-----------------|-------------|----------------------------------------------------------|
| `provider`      | `string`    | `"openai"` \| `"gemini"` \| `"anthropic"` \| `"groq"` \| `"mistral"` |
| `model`         | `string`    | Model name (e.g. `"gpt-4o-mini"`, `"gemini-2.0-flash-exp"`) |
| `apiKey`        | `string`    | Provider API key (admin-only read)                       |
| `updatedAt`     | `Timestamp` | Last config save                                         |
| `lastRun`       | `Timestamp` | Last processing run timestamp                            |
| `lastRunSummary`| `map`       | `{ processed, errors, groupCount, groups[] }`            |

**Rules summary:** Admin read/write only. Cloud Function uses Admin SDK (bypasses rules).

---

## LLM Nightly Processing

### How it works

1. **Scheduled function** (`processNightly`) triggers every night at **11:00 PM IST** (17:30 UTC).
2. Reads all `raw_responses` with `status == "unprocessed"`.
3. Groups responses by `(company_id, role_id)`.
4. For each group, calls the LLM with:
   - All raw technical questions (from all student responses)
   - All raw HR questions
   - Raw topics
   - Existing questions (from `questions` collection, to avoid duplication)
5. LLM returns:
   - **Cleaned technical questions** (deduped, typos fixed, merged near-duplicates)
   - **Cleaned HR questions** (same)
   - **8 additional practice questions** (campus/internship level, AI-generated)
   - **Cleaned topics list**
6. Results are **merged** into the existing `questions` document (or a new one is created). One document per company+role.
7. All processed `raw_responses` are marked `status: "processed"`.

### LLM Prompt Design
The prompt is in `functions/prompt.js`. Key features:
- Provides full context (company, role, topics)
- Lists existing questions explicitly → LLM avoids duplicates
- Asks for exactly 8 additional questions at college/internship level
- Enforces JSON-only output with strict schema

### Admin Config Tab
Admins can configure:
- **Provider**: OpenAI, Google Gemini, Anthropic, Groq, Mistral
- **Model**: Provider-specific dropdown with recommended options
- **API Key**: Masked input, stored in `config/llm` (admin-only access)
- **Process Now**: Manual trigger that calls the `processNow` Cloud Function
- Processing status shows: pending count, last run time, per-group results

### Supported LLM Providers & Recommended Models

| Provider  | Recommended Model        | Notes                         |
|-----------|--------------------------|-------------------------------|
| OpenAI    | `gpt-4o-mini`            | Best balance of speed/quality |
| Gemini    | `gemini-2.0-flash-exp`   | Fast, free tier available     |
| Anthropic | `claude-3-5-sonnet-latest` | High quality, structured output |
| Groq      | `llama-3.3-70b-versatile`| Very fast, free tier          |
| Mistral   | `mistral-large-latest`   | Good for structured JSON      |

### Cloud Function Deployment
```bash
cd functions
npm install
firebase deploy --only functions
```

Both `processNightly` (scheduled) and `processNow` (callable) are deployed together.
The `onDailyUsageWrite` trigger (usage streak calculator) is also in the same deployment.

---

## Usage Tracking

Implemented via `src/hooks/useUsageTracker.js`. Active only for authenticated students on `Home` page.

### How it works
1. **On mount** — records `visibleSince = Date.now()` if tab is visible; fetches student branch for the summary doc.
2. **While browsing** — counts time only when `document.visibilityState === "visible"`. Pauses automatically on tab switch / phone lock.
3. **Flush triggers:**
   - Tab goes hidden (`visibilitychange`) — most reliable
   - Every 5 minutes while active — safety net
   - Page unload (`beforeunload`) — best-effort
   - Component unmount (sign-out)
4. **Each flush** writes:
   - `usage/{uid}` — `increment(minutes)` for `totalMinutes` + `lastSeen`
   - `usage/{uid}/daily/{YYYY-MM-DD}` — `increment(minutes)` for the day

### Admin Statistics (`Statistics` tab in Admin Dashboard)
- **KPI cards**: Tracked students, average active time, most active branch, active today.
- **Pie chart**: Share of total minutes by branch.
- **Bar chart**: Average time per student by branch.
- **Total usage by branch**: Combined minutes per branch.
- **Student count by branch**: How many tracked students per branch.
- **Top 10 leaderboard**: Horizontal bar chart of most active students.
- **Student table**: All students sorted by time; click any row to expand their 30-day daily activity area chart.
- **Branch filter**: Filters all stats to a selected branch.

### Optional Cloud Function (`functions/index.js`)
Deploy with `firebase deploy --only functions` to enable:
- Server-side recalculation of `totalMinutes` from ground-truth daily docs (fixes any client-side discrepancy).
- Streak calculation (consecutive active days).

The Stats panel works fully without the Cloud Function (client-side increments are sufficient for a college-scale portal).

---

## Firestore Security Rules

Rules are in `firestore.rules` at the project root.

Deploy with:
```bash
firebase deploy --only firestore:rules
```

Key guarantees:
1. **Unauthenticated users** — can only create `raw_responses`; can read `companies`, `roles`, `branches`, `students` (needed for student form dropdowns + autofill).
2. **Non-Thapar emails** — blocked from the auth-gated portal; Firestore rules enforce `@thapar.edu` for authenticated operations.
3. **Students** — read-only access to `questions`, `companies`, `roles`, `branches`; read their own `users` and `students` documents.
4. **Admins** — full read/write on all collections.
5. **Role escalation** — students cannot change their own `role` field.
6. **raw_responses** — public write (form submissions), admin-only read/update/delete.
7. **submissionLocks** — publicly readable and writable (required for the unauthenticated form transaction); contains no sensitive data.

---

## Excel Upload Format

Admins upload `.xlsx` or `.csv` files with the following columns (header row required):

| Column   | Required | Notes                            |
|----------|----------|----------------------------------|
| `name`   | Yes      | Student full name                |
| `roll`   | Yes      | Roll number (any string)         |
| `email`  | Yes      | Must be `@thapar.edu`            |
| `branch` | Yes      | E.g. `CSE`, `ECE`, `ME`          |

- Rows with missing columns or non-Thapar emails are skipped with a warning.
- Existing student records are **merged** (not overwritten) — existing fields not in the file are preserved.

---

## Role Management

To promote a student to admin:
1. Find the user's document in Firebase Console → Firestore → `users` collection.
2. Change `role` from `"student"` to `"admin"`.
3. The user will see the Admin Dashboard on their next sign-in (or after a page reload).
