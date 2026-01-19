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
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>HireBot</h1>
          </div>
          
          {/* Right: Navigation and Logout */}
          <div className="flex items-center gap-4">
            {/* Admin Navigation */}
            {isAdmin && (
              <Link
                to="/dashboard/admin"
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  location.pathname.includes("/dashboard/admin") 
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
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    location.pathname.includes("/dashboard/hr") 
                      ? "bg-hb-primary text-white shadow-md" 
                      : "text-gray-700 hover:bg-gray-100 hover:text-hb-primary"
                  }`}
                >
                  HR Contacts
                </Link>
                <Link
                  to="/dashboard/students"
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    location.pathname.includes("/dashboard/students") 
                      ? "bg-hb-primary text-white shadow-md" 
                      : "text-gray-700 hover:bg-gray-100 hover:text-hb-primary"
                  }`}
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
