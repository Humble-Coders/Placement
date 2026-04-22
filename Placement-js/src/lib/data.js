// ─── Client-side filter helpers ──────────────────────────────────────────────
//
// All data is held in the DataContext (real-time listeners). These pure
// functions filter the already-loaded arrays — no Firestore calls here.

export function getQuestionsByCompany(questions, companyId) {
  return questions.filter((q) => q.company_id === companyId);
}

export function getQuestionsByRole(questions, roleId) {
  return questions.filter((q) => q.role_id === roleId);
}

export function getQuestionsByBranch(questions, branchName) {
  const lower = branchName.toLowerCase();
  return questions.filter((q) => {
    const inBranches =
      Array.isArray(q.branches) &&
      q.branches.some((b) => b.toLowerCase() === lower);
    const inOfficialBranches =
      Array.isArray(q.official_branches) &&
      q.official_branches.some((b) => b.toLowerCase() === lower);
    return inBranches || inOfficialBranches;
  });
}

export function getCompaniesByBranch(questions, companies, branchName) {
  const ids = new Set(
    getQuestionsByBranch(questions, branchName).map((q) => q.company_id)
  );
  return companies.filter((c) => ids.has(c.id));
}
