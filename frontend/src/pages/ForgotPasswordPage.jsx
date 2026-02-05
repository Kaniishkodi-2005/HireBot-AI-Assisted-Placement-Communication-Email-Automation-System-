import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import http from "../services/httpClient";

function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpInputRefs = useRef([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Timer State
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  // Timer Effect
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft]);

  // Helper to format 0:00
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle individual OTP digit change
  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace to move prev
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await http.post('/auth/forgot-password', { email });
      setMessage("OTP sent to your email successfully!");
      setStep(2);
      setTimeLeft(120); // 2 minutes validity
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
        otp: otp.join(""),
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
    <div className="min-h-screen flex items-center justify-center bg-hb-bg dark:bg-slate-900 px-4 transition-colors duration-200">
      <div className="w-full max-w-md bg-hb-card dark:bg-slate-800 rounded-xl shadow-xl p-8 space-y-6 border border-gray-200 dark:border-slate-700 transition-colors duration-200">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/hirebot-logo.jpg" alt="HireBot" className="w-12 h-12 rounded-full shadow-md object-cover" />
            <h1 className="text-4xl font-black text-gray-900 dark:text-white" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>HireBot</h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">AI-Assisted Placement Communication & Shortlisting System</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-1">Forgot Password?</h2>
          <p className="text-xs text-center text-gray-600 dark:text-gray-400">
            {step === 1 ? "Enter your registered email to receive OTP" : "Enter OTP and new password"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {message && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-green-600 dark:text-green-400 text-sm text-center">{message}</p>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
                placeholder="Enter your registered email"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white focus:outline-none transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#AF69F8' }}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Email Address</label>
              <input
                type="email"
                value={email}
                className="w-full rounded-lg bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 px-4 py-3 text-sm text-gray-900 dark:text-gray-200 cursor-not-allowed transition-colors"
                disabled
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">OTP Code</label>
                <span className="text-xs font-medium text-gray-400">
                  {timeLeft > 0 ? `Expires in ${formatTime(timeLeft)}` : 'Expired'}
                </span>
              </div>
              <div className="flex justify-between gap-2 max-w-sm mx-auto">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => otpInputRefs.current[index] = el}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-10 h-10 md:w-11 md:h-12 text-center text-xl font-bold border-2 border-gray-200 dark:border-slate-600 rounded-lg focus:border-[#AF69F8] dark:focus:border-[#AF69F8] focus:ring-0 outline-none text-gray-800 dark:text-white shadow-sm bg-white dark:bg-slate-900 transition-colors"
                    disabled={loading}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 pr-12 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
                  placeholder="Enter new password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  {showNewPassword ? (
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

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 pr-12 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
                  placeholder="Re-enter new password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  {showConfirmPassword ? (
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
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white focus:outline-none transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#AF69F8' }}
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link to="/login" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
