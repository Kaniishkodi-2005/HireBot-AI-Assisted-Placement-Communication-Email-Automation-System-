import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import http from "../services/httpClient";

function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    
    try {
      await http.post('/auth/forgot-password', { email });
      setMessage("OTP sent to your email successfully!");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    
    setLoading(true);
    
    try {
      await http.post('/auth/reset-password', { 
        email, 
        otp, 
        new_password: newPassword 
      });
      setMessage("Password reset successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reset password. Please check your OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-hb-bg px-4">
      <div className="w-full max-w-md bg-hb-card rounded-xl shadow-xl p-8 space-y-6 border border-gray-200">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-gray-900" style={{fontFamily: 'Inter, system-ui, -apple-system, sans-serif'}}>HireBot</h1>
          </div>
          <p className="text-sm text-gray-600">AI-Assisted Placement Communication & Shortlisting System</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">Forgot Password?</h2>
          <p className="text-xs text-center text-gray-600">
            {step === 1 ? "Enter your registered email to receive OTP" : "Enter OTP and new password"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-green-600 text-sm text-center">{message}</p>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
                placeholder="Enter your registered email"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-hb-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Email Address</label>
              <input
                type="email"
                value={email}
                className="w-full rounded-lg bg-gray-100 border border-gray-300 px-4 py-3 text-sm text-gray-900"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">OTP Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
                placeholder="Enter 6-digit OTP"
                maxLength="6"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
                placeholder="Enter new password"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
                placeholder="Re-enter new password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-hb-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
