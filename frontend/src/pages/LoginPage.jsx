import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/authContext";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, googleLogin, user, loading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") {
        navigate("/dashboard/admin", { replace: true });
      } else if (user.role === "user") {
        navigate("/dashboard/hr", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Check for origin mismatch which common cause of Google 403
    if (window.location.hostname === "localhost" &&
      import.meta.env.VITE_GOOGLE_CLIENT_ID?.includes("54602439728")) {
      console.warn("DANGER: You are on 'localhost'. Google often blocks this. Try http://127.0.0.1:5173 instead.");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const auth = await login(email, password);
      console.log("Login successful, user role:", auth.user.role);
      if (auth.user.role === "admin") {
        navigate("/dashboard/admin", { replace: true });
      } else if (auth.user.role === "user") {
        navigate("/dashboard/hr", { replace: true });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || "Login failed. Please check your credentials.";
      setError(errorMessage);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hb-bg">
        <div className="text-gray-900">Loading...</div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hb-bg dark:bg-slate-900 px-4 py-8 transition-colors duration-200">
      <div className="w-full max-w-md bg-hb-card dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-6 border border-gray-100 dark:border-slate-700 transition-all duration-300">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/hirebot-logo.jpg" alt="HireBot" className="w-12 h-12 rounded-full shadow-md object-cover" />
            <h1 className="text-4xl font-black text-gray-900 dark:text-white" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>HireBot</h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">AI-Assisted Placement Communication & Email Automation System</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-1">Welcome Back</h2>
          <p className="text-xs text-center text-gray-600 dark:text-gray-400">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5 ml-1 text-gray-700 dark:text-gray-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 ml-1 text-gray-700 dark:text-gray-300">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 pr-12 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white active:scale-[0.98] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus:outline-none"
            style={{ backgroundColor: '#AF69F8' }}
          >
            Log In
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-hb-card dark:bg-slate-800 text-gray-500 dark:text-gray-400 transition-colors">Or continue with</span>
          </div>
        </div>

        <div className="relative flex justify-center w-full">
          {/* Custom Styled Button */}
          <button
            type="button"
            className="w-[60%] mx-auto flex items-center justify-between px-1 py-1 rounded-full shadow-md transition-all text-white relative"
            style={{ backgroundColor: '#AF69F8', height: '40px' }}
          >
            <div className="bg-white rounded-full h-full aspect-square flex items-center justify-center p-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <span className="flex-1 text-center font-medium pr-8 text-sm">Sign in with Google</span>
          </button>

          {/* Invisible Google Login Button Overlay - Left unchanged */}
          <div className="absolute inset-0 opacity-0 overflow-hidden rounded-full">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                setError("");
                try {
                  const auth = await googleLogin(credentialResponse.credential);
                  const targetPath = auth.user.role === "admin" ? "/dashboard/admin" : "/dashboard/hr";
                  navigate(targetPath, { replace: true });
                } catch (err) {
                  const errorMessage = err.response?.data?.detail || err.message || "Google login failed. Please try again.";
                  setError(errorMessage);
                }
              }}
              onError={(error) => {
                console.error("Google OAuth Error:", error);
                setError("Google login failed. Please try again.");
              }}
              theme="filled_blue"
              size="large"
              shape="pill"
              text="signin_with"
              width="400"
              logo_alignment="left"
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-sm">
          <Link to="/forgot-password" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors">
            Forgot Password?
          </Link>
          <Link to="/signup" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors">
            Sign Up
          </Link>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;
