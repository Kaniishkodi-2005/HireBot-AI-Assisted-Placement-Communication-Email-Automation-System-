import { useState } from 'react';
import { Lock, Key, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import http from '../../services/httpClient';

export default function SecurityTab() {
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [status, setStatus] = useState(null); // 'success', 'error', or null
  const [is2FAEnabled, setIs2FAEnabled] = useState(false); // Mock state for 2FA

  const handleChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (passwords.new !== passwords.confirm) {
      setStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    try {
      await http.post('/auth/change-password', {
        current_password: passwords.current,
        new_password: passwords.new,
        confirm_password: passwords.confirm
      });

      setStatus({ type: 'success', message: 'Password updated successfully!' });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error("Password change failed:", error);
      const errorMsg = error.response?.data?.detail || "Failed to update password. Check your current password.";
      setStatus({ type: 'error', message: errorMsg });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Password & Security</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage your login credentials</p>
          </div>
          <ShieldCheck className="w-5 h-5 text-green-500" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {status?.type === 'success' && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> {status.message}
            </div>
          )}
          {status?.type === 'error' && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
              {status.message}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" /> Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? "text" : "password"}
                name="current"
                value={passwords.current}
                onChange={handleChange}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:border-[#AF69F8] dark:focus:border-[#AF69F8] focus:ring-0 transition-all shadow-sm"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
              >
                {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" /> New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  name="new"
                  value={passwords.new}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:border-[#AF69F8] dark:focus:border-[#AF69F8] focus:ring-0 transition-all shadow-sm"
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" /> Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  name="confirm"
                  value={passwords.confirm}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:border-[#AF69F8] dark:focus:border-[#AF69F8] focus:ring-0 transition-all shadow-sm"
                  placeholder="Confirm new password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 text-white text-sm font-semibold rounded-lg hover:opacity-90 shadow-lg shadow-purple-200 dark:shadow-purple-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: '#AF69F8' }}
            >
              Update Password
            </button>
          </div>
        </form>
      </div>


    </div>
  );
}
