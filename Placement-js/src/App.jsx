import { Toaster } from "sonner";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentForm from "./pages/StudentForm";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import { BookOpen } from "lucide-react";

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8fafc]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-100">
        <BookOpen className="h-6 w-6 text-white" />
      </div>
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
      <p className="text-sm font-medium text-slate-500">Loading…</p>
    </div>
  );
}

// Student experience submission form — public, no auth required
function isFormRoute() {
  return window.location.pathname === "/form";
}

function AppRoutes() {
  const { user, role, loading } = useAuth();

  // Public route: always accessible
  if (isFormRoute()) return <StudentForm />;

  if (loading) return <FullPageSpinner />;
  if (!user) return <AuthPage />;
  // Admins are trusted accounts created manually — skip verification gate.
  if (!user.emailVerified && role !== "admin") return <EmailVerificationPage />;
  if (role === "admin") return <AdminDashboard />;
  return <Home />;
}

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster position="top-right" theme="light" />
    </>
  );
}

export default App;
