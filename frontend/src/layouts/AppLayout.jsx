import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { useEffect } from "react";

function AppLayout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const isUser = user?.role === "user";

  // Redirect to login if no user
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Don't render if no user
  if (loading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-hb-bg text-gray-900">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <img src="/hirebot-logo.jpg" alt="Logo" className="w-10 h-10 rounded-full shadow-md object-cover" />
            <h1 className="text-3xl font-black text-gray-900 tracking-tight" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>HireBot</h1>
          </div>

          {/* Right: User Info, Navigation and Logout */}
          <div className="flex items-center gap-4">
            {/* User Info - Shows current user email and role */}
            <div className="text-sm text-gray-600 border-r border-gray-300 pr-4">
              <div className="font-medium text-gray-900">{user.email}</div>
              <div className="text-xs text-gray-500">Role: {user.role}</div>
            </div>

            {/* Admin Navigation */}
            {isAdmin && (
              <Link
                to="/dashboard/admin"
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname.includes("/dashboard/admin")
                  ? "bg-hb-primary text-white shadow-md"
                  : "text-gray-700 hover:bg-gray-100 hover:text-hb-primary"
                  }`}
              >
                Admin Dashboard
              </Link>
            )}

            {/* User Navigation */}
            {isUser && (
              <>
                <Link
                  to="/dashboard/hr"
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname.includes("/dashboard/hr")
                    ? "text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100 hover:text-hb-primary"
                    }`}
                  style={location.pathname.includes("/dashboard/hr") ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
                >
                  HR Contacts
                </Link>
                <Link
                  to="/dashboard/students"
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname.includes("/dashboard/students")
                    ? "text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100 hover:text-hb-primary"
                    }`}
                  style={location.pathname.includes("/dashboard/students") ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
                >
                  Students
                </Link>
              </>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold text-white transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-hb-bg">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
