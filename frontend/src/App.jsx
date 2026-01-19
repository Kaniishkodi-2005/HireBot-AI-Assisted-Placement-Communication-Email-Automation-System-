import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/authContext";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HrDashboardPage from "./pages/HrDashboardPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import EditStudentsPage from "./pages/EditStudentsPage";
import EditHrContactsPage from "./pages/EditHrContactsPage";

// Protected route wrapper for role-based access
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-hb-bg text-gray-900">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    // Redirect based on role
    if (user.role === "admin") {
      return <Navigate to="/dashboard/admin" replace />;
    } else if (user.role === "user") {
      return <Navigate to="/dashboard/hr" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<AppLayout />}>
        {/* User routes - accessible to "user" role only */}
        <Route
          path="/dashboard/hr"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <HrDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/students"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/students/edit"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <EditStudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/hr/edit"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <EditHrContactsPage />
            </ProtectedRoute>
          }
        />
        
        {/* Admin route - accessible only to "admin" role */}
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;


