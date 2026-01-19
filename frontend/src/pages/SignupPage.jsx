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
              className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
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
              className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
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
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
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
                className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:border-transparent"
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>Requirements:</strong> Password must be at least 8 characters. The first registered user automatically becomes Admin with full access.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-hb-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-hb-primary focus:ring-offset-2 transition-colors"
          >
            Create Account
          </button>
        </form>

        <p className="text-sm text-center text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
