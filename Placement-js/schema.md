# HumblePrep — Firestore Schema

> Last updated: 2026-04-14 (v2 — student form + branches + raw_responses)

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
