import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

let _cache = null;

export async function fetchAllData() {
  if (_cache) return _cache;

  const [questionsSnap, companiesSnap, rolesSnap, branchesSnap] =
    await Promise.all([
      getDocs(collection(db, "questions")),
      getDocs(collection(db, "companies")),
      getDocs(collection(db, "roles")),
      getDocs(collection(db, "branches")),
    ]);

  const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const companies = companiesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const roles = rolesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const branches = branchesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  _cache = { questions, companies, roles, branches };
  return _cache;
}

// Search helpers — all local filtering after initial fetch

export function getQuestionsByCompany(questions, companyId) {
  return questions.filter((q) => q.company_id === companyId);
}

export function getQuestionsByRole(questions, roleId) {
  return questions.filter((q) => q.role_id === roleId);
}

export function getQuestionsByBranch(questions, branchName) {
  const lower = branchName.toLowerCase();
  return questions.filter((q) => {
    const inBranches = Array.isArray(q.branches) && q.branches.some((b) => b.toLowerCase() === lower);
    const inOfficialBranches = Array.isArray(q.official_branches) && q.official_branches.some((b) => b.toLowerCase() === lower);
    return inBranches || inOfficialBranches;
  });
}

export function getCompaniesByBranch(questions, companies, branchName) {
  const ids = new Set(
    getQuestionsByBranch(questions, branchName).map((q) => q.company_id)
  );
  return companies.filter((c) => ids.has(c.id));
}
