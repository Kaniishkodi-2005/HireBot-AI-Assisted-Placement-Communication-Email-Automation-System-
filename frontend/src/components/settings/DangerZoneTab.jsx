import { useState } from 'react';
import { Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/authContext';
import { deleteAccount } from '../../services/authService';

export default function DangerZoneTab() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user, logout } = useAuth();

  const handleDelete = async () => {
    if (!user?.id) return;

    setIsDeleting(true);
    try {
      await deleteAccount(user.id);
      alert("Your account has been permanently deleted.");
      logout();
    } catch (error) {
      console.error("Failed to delete account:", error);
      alert(error.response?.data?.detail || "Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm overflow-hidden transition-colors duration-200">
        <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500" />
          <h2 className="text-lg font-bold text-red-900 dark:text-red-300">Danger Zone</h2>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-xl shrink-0">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Account</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-lg">
                Once you delete your account, there is no going back. Please be certain. All your data, including emails and contacts, will be permanently removed.
              </p>

              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="mt-4 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-300 dark:hover:border-red-800 transition-colors shadow-sm"
                >
                  Delete Account
                </button>
              ) : (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-2 mb-3 text-red-800 dark:text-red-300 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" /> Are you absolutely sure?
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-sm font-normal rounded-lg hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? "Deleting..." : "Yes, Delete Permanently"}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
