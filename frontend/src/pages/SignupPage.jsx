import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupRequest } from "../services/authService";

function SignupPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirm_password: "",
    organization: ""
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const res = await signupRequest(form);
      setMessage(
        `Account created successfully! Role: ${res.role}. Redirecting to login...`
      );
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error('Signup error:', err);
      console.error('Error response:', err.response);

      // Extract detailed error message
      let errorMessage = "Signup failed. Please check your details.";

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;

        // Handle validation errors (array format)
        if (Array.isArray(detail)) {
          errorMessage = detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(', ');
        }
        // Handle string error messages
        else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = "Cannot connect to server. Please ensure the backend is running on port 8000.";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error occurred. Please check backend logs and restart the server.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-hb-bg px-4">
      <div className="w-full max-w-lg bg-hb-card rounded-xl shadow-xl p-8 space-y-6 border border-gray-200">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/hirebot-logo.jpg" alt="HireBot" className="w-12 h-12 rounded-full shadow-md object-cover" />
            <h1 className="text-4xl font-black text-gray-900" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>HireBot</h1>
          </div>
          <p className="text-sm text-gray-600">AI-Assisted Placement Communication & Shortlisting System</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">Create Account</h2>
          <p className="text-xs text-center text-gray-600">Register as a new placement officer</p>
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Organization / College Name</label>
            <input
              name="organization"
              value={form.organization}
              onChange={handleChange}
              className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6B64F2] focus:border-transparent"
              placeholder="Enter your college/organization name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6B64F2] focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6B64F2] focus:border-transparent"
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Confirm Password</label>
              <input
                type="password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6B64F2] focus:border-transparent"
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-xs text-purple-700">
              <strong>Requirements:</strong> Password must be at least 8 characters. The first registered user automatically becomes Admin with full access.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all shadow-md"
            style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}
          >
            Create Account
          </button>
        </form>

        <p className="text-sm text-center text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-600 hover:text-purple-700 hover:underline font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
