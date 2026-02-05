import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupRequest, sendOtpRequest, verifyOtpRequest } from "../services/authService";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

function SignupPage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    organization: ""
  });

  // OTP State
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpInputRefs = useRef([]);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States for Verification Flow
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Timer Effect
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Reset verification if email changes
    if (e.target.name === "email") {
      if (isEmailVerified || isOtpSent) {
        setIsEmailVerified(false);
        setIsOtpSent(false);
        setOtp(["", "", "", "", "", ""]);
        setTimeLeft(0);
        setMessage("");
        setError("");
      }
    }
  };

  const handleSendOTP = async () => {
    if (!form.email) {
      setError("Please enter an email address first.");
      return;
    }

    // Prevent spam clicking if timer is active
    if (timeLeft > 0) return;

    setError("");
    setMessage("");
    setVerificationLoading(true);

    try {
      await sendOtpRequest(form.email);
      setIsOtpSent(true);
      setMessage("Verification code sent! Please check your inbox.");
      setOtp(["", "", "", "", "", ""]); // Reset OTP inputs on new send

      // Start 60s timer
      setTimeLeft(120); // 2 minutes validity

      // Focus first OTP input when it appears
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send verification code. Please try again.");
    } finally {
      setVerificationLoading(false);
    }
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

    // Auto-verify if all 6 digits entered
    const fullOtp = newOtp.join("");
    if (fullOtp.length === 6 && index === 5 && value) {
      verifyOtpLogic(fullOtp);
    } else if (fullOtp.length === 6) {
      verifyOtpLogic(fullOtp);
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace to move prev
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const verifyOtpLogic = async (code) => {
    setError("");
    setVerificationLoading(true);
    try {
      await verifyOtpRequest(form.email, code);
      setIsEmailVerified(true);
      setIsOtpSent(false);
      setMessage("Email verified successfully! You can now set your password.");
      setTimeLeft(0); // Stop timer
    } catch (err) {
      const msg = err.response?.data?.detail;
      let displayMsg = "Invalid verification code. Please check and try again.";

      if (msg?.includes("No OTP found") || msg?.includes("expired")) {
        displayMsg = "Verification code has expired. Please request a new code.";
      } else if (msg?.includes("Invalid OTP")) {
        displayMsg = "Incorrect code entered. Please try again.";
      }

      setError(displayMsg);
      setOtp(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!isEmailVerified) {
      setError("Please verify your email address before signing up.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await signupRequest(form);
      setMessage(
        `Account created successfully! Redirecting to login...`
      );
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error('Signup error:', err);
      let errorMessage = "Unable to create account. Please check your details.";
      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        errorMessage = detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(', ');
      } else if (typeof detail === 'string') {
        if (detail.includes("exists")) errorMessage = "An account with this email already exists.";
        else errorMessage = detail;
      } else if (err.response?.status === 500) {
        errorMessage = "Server error: Unable to save account. Please try again later or contact support.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format 0:00
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Shared button style
  // Shared button style
  const primaryGradientStyle = { backgroundColor: '#AF69F8' };

  return (
    <div className="min-h-screen flex items-center justify-center bg-hb-bg dark:bg-slate-900 px-4 py-8 font-sans transition-colors duration-200">
      <div className="w-full max-w-lg bg-hb-card dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-6 border border-gray-100 dark:border-slate-700 transition-all duration-300">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/hirebot-logo.jpg" alt="HireBot" className="w-12 h-12 rounded-full shadow-md object-cover" />
            <h1 className="text-4xl font-black text-gray-900 dark:text-white" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>HireBot</h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Create your placement officer account</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl p-4 flex items-start gap-2 animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-xl p-4 flex items-center gap-2 animate-fade-in-down">
            <CheckCircle className="w-5 h-5 flex-shrink-0" /> {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Full Name</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
              placeholder="Enter your full name"
              required
            />
          </div>

          {/* Organization */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Organization / College Name</label>
            <input
              name="organization"
              value={form.organization}
              onChange={handleChange}
              className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
              placeholder="Enter organization name"
              required
            />
          </div>

          {/* Email Verification Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Email Address</label>
            <div className={`relative flex gap-3 ${isEmailVerified ? 'opacity-80' : ''}`}>
              {/* Fixed: Removed green background/border on verified state, mostly kept neutral but disabled */}
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={`w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors ${isEmailVerified ? 'text-gray-600 dark:text-gray-400' : ''}`}
                placeholder="name@example.com"
                required
                disabled={isEmailVerified}
              />

              {!isEmailVerified && (
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={verificationLoading || !form.email || (timeLeft > 0 && isOtpSent)}
                  className="px-5 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-md min-w-[100px] transition-all"
                  style={primaryGradientStyle}
                >
                  {verificationLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                    (timeLeft > 0 ? formatTime(timeLeft) : (isOtpSent ? "Resend" : "Verify"))
                  }
                </button>
              )}

              {isEmailVerified && (
                <div className="absolute right-4 top-3.5 text-green-500 animate-scale-in">
                  <CheckCircle className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>

          {/* OTP Input */}
          {isOtpSent && !isEmailVerified && (
            <div className="animate-fade-in-down py-4 bg-gray-50/50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700 px-4">
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[#AF69F8]">Enter Verification Code</label>
                <span className="text-xs font-medium text-gray-400">{timeLeft > 0 ? `Expires in ${formatTime(timeLeft)}` : 'Expired'}</span>
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
                    disabled={verificationLoading}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              {verificationLoading && (
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-[#AF69F8] font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying code...
                </div>
              )}
            </div>
          )}

          {/* Password Fields */}
          <div className={`grid grid-cols-2 gap-4 transition-all duration-500 ${!isEmailVerified ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100 grayscale-0'}`}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-0 focus:border-[#AF69F8] dark:focus:border-[#AF69F8] transition-colors"
                  placeholder="Min 8 chars"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Confirm</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 px-4 py-3 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6B64F2] focus:border-transparent transition-all"
                  placeholder="Confirm"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !isEmailVerified}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white active:scale-[0.98] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none focus:outline-none"
              style={primaryGradientStyle}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Account"}
            </button>
          </div>
        </form>

        <p className="text-sm text-center text-gray-600 dark:text-gray-400 font-medium">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
