import { useState, useEffect } from 'react';
import { useAuth } from '../../context/authContext';
import http from '../../services/httpClient';
import { User, Mail, Briefcase, Building } from 'lucide-react';

export default function ProfileAccountTab() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  // Initialize state with user values or defaults
  // Prefer user.full_name, fallback to user.name (logic for Google vs DB), fallback to placeholders
  const [formData, setFormData] = useState({
    name: user?.full_name || user?.name || user?.email?.split('@')[0] || "User",
    email: user?.email || "",
    role: user?.role || "",
    organization: user?.organization || "",
  });

  // Update form data if user context changes (e.g. after login/re-fetch)
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.full_name || user.name || user.email?.split('@')[0] || "User",
        email: user.email || "",
        role: user.role || "",
        organization: user.organization || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || !user.id) {
      alert("User ID missing. Please log out and log in again.");
      return;
    }

    try {
      const response = await http.put(`/auth/users/${user.id}`, {
        full_name: formData.name,
        organization: formData.organization,
      });

      console.log("Profile updated:", response.data);

      // Update local storage correctly
      const storedAuth = localStorage.getItem('hirebot_auth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        if (authData.user) {
          authData.user.full_name = formData.name;
          authData.user.organization = formData.organization;
          localStorage.setItem('hirebot_auth', JSON.stringify(authData));
        }
      }

      // Force reload to update context
      window.location.reload();

      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      const msg = error.response?.data?.detail || error.message || "Failed to update profile";
      alert(msg);
    }
  };

  // Common input class logic
  const getInputClass = (editing) => `
    w-full px-4 py-2.5 rounded-xl border-2 text-sm transition-all outline-none
    ${editing
      ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 text-slate-900 dark:text-white focus:border-[#AF69F8] dark:focus:border-[#AF69F8] focus:ring-0 shadow-sm'
      : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-500 dark:text-slate-400 cursor-not-allowed'
    }
  `;

  return (
    <div className="space-y-6">
      {/* Header with Avatar */}
      <div className="flex items-center gap-6 pb-6 border-b border-gray-100 dark:border-slate-800">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6B64F2] to-[#A656F7] flex items-center justify-center text-white text-3xl font-bold shadow-lg">
          {formData.name[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formData.name}</h2>
          <p className="text-gray-500 dark:text-gray-400">{formData.role.charAt(0).toUpperCase() + formData.role.slice(1)} at {formData.organization}</p>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="mt-3 text-sm font-medium text-[#9333ea] hover:text-[#7e22ce] hover:underline transition-colors"
          >
            {isEditing ? "Cancel Editing" : "Edit Profile Details"}
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" /> Full Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={!isEditing}
            className={getInputClass(isEditing)}
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" /> Email Address
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            disabled
            className="w-full px-4 py-2.5 rounded-xl border border-transparent bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 pl-1">Contact admin to change email</p>
        </div>

        {/* Organization */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-400" /> Organization
          </label>
          <input
            type="text"
            name="organization"
            value={formData.organization}
            onChange={handleChange}
            disabled={!isEditing}
            className={getInputClass(isEditing)}
          />
        </div>

        {/* Role (Read Only) */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-400" /> System Role
          </label>
          <div className="w-full px-4 py-2.5 rounded-lg bg-purple-50 dark:bg-slate-900 border border-purple-100 dark:border-slate-800 text-[#6B64F2] text-sm font-medium flex items-center justify-between">
            <span className="capitalize">{formData.role}</span>
            <span className="text-xs text-[#6B64F2] uppercase tracking-wider font-bold opacity-80">Read Only</span>
          </div>
        </div>

        {/* Actions */}
        {isEditing && (
          <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  name: user?.full_name || user?.name || user?.email?.split('@')[0] || "User",
                  email: user?.email || "",
                  role: user?.role || "",
                  organization: user?.organization || "",
                });
              }}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-slate-200 text-slate-700 dark:text-slate-300 shadow-sm transition-all transform active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-purple-500/20 transition-all text-white transform active:scale-95 hover:shadow-purple-500/30"
              style={{ backgroundColor: '#AF69F8' }}
            >
              Save Changes
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
