import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import http from "../services/httpClient";
import { Users, UserCheck, UserX, UserPlus } from "lucide-react";

function AdminDashboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [accessLogs, setAccessLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (showLogsModal) {
      fetchLogs();
    }
  }, [showLogsModal]);

  useEffect(() => {
    if (showLogsModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showLogsModal]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data } = await http.get('/auth/logs');
      setAccessLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all login logs? This action cannot be undone.")) {
      return;
    }
    try {
      await http.delete('/auth/logs');
      setAccessLogs([]); // Clear local state
      setNotification({ message: "Logs cleared successfully", type: "success" });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Failed to clear logs:', error);
      setNotification({ message: "Failed to clear logs", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await http.get("/auth/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await http.post(`/auth/users/${userId}/approve`);
      setNotification({ message: "User approved successfully", type: "success" });
      setTimeout(() => setNotification(null), 3000);
      loadUsers();
    } catch (error) {
      setNotification({ message: "Failed to approve user", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDecline = async (userId) => {
    try {
      await http.post(`/auth/users/${userId}/decline`);
      setNotification({ message: "User declined successfully", type: "success" });
      setTimeout(() => setNotification(null), 3000);
      loadUsers();
    } catch (error) {
      setNotification({ message: "Failed to decline user", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await http.put(`/auth/users/${userId}/role?role=${newRole}`);
      setNotification({ message: `Role updated to ${newRole}`, type: "success" });
      setTimeout(() => setNotification(null), 3000);
      loadUsers();
    } catch (error) {
      setNotification({ message: "Failed to update role", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    }
  };



  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.organization || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === "All") return matchesSearch;
    if (filterStatus === "Approved") return matchesSearch && user.is_approved;
    if (filterStatus === "Pending") return matchesSearch && !user.is_approved && user.is_active;
    if (filterStatus === "Declined") return matchesSearch && !user.is_active; // Assuming declined users have is_active=false

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {notification.message}
        </div>
      )}

      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">Access Management</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors">
            Control who can access the system, manage user permissions, and approve registrations
          </p>
        </div>
        <button
          onClick={() => setShowLogsModal(true)}
          className="relative px-5 py-2 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 text-white transform active:scale-95"
          style={{ backgroundColor: '#AF69F8' }}
        >
          <span className="text-lg">📋</span>
          View Login Logs
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-purple-50/20 dark:hover:bg-purple-900/10 border border-transparent hover:border-purple-200 dark:hover:border-purple-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mt-2">Total Users</p>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <Users className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">{(users || []).length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-emerald-50/20 dark:hover:bg-emerald-900/10 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mt-2">Active Users</p>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <UserCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{(users || []).filter(u => u.is_approved && u.is_active).length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-red-50/20 dark:hover:bg-red-900/10 border border-transparent hover:border-red-200 dark:hover:border-red-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors mt-2">Declined Users</p>
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <UserX className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">{(users || []).filter(u => !u.is_active).length}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-amber-50/20 dark:hover:bg-amber-900/10 border border-transparent hover:border-amber-200 dark:hover:border-amber-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mt-2">Pending Approval</p>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <UserPlus className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{(users || []).filter(u => !u.is_approved && u.is_active).length}</p>
        </div>
      </div>

      {/* User Management Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">User Accounts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 transition-colors">Approve, decline, or manage user access and roles</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`bg-white dark:bg-slate-800 border-2 hover:border-slate-200 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 whitespace-nowrap ${filterStatus !== 'All' ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-100 dark:border-slate-700'}`}
              >
                <svg className={`w-4 h-4 ${filterStatus !== 'All' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {filterStatus}
                {filterStatus !== 'All' && (
                  <span onClick={(e) => { e.stopPropagation(); setFilterStatus('All'); }} className="ml-1 hover:text-purple-800 dark:hover:text-purple-300 rounded-full p-0.5">✕</span>
                )}
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-fade-in">
                  {['All', 'Approved', 'Pending', 'Declined'].map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilterStatus(status);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-between ${filterStatus === status ? 'text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                    >
                      {status}
                      {filterStatus === status && <span className="text-purple-600">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative w-full md:w-64">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 rounded-xl pl-10 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-slate-200 dark:focus:border-slate-500 transition-colors font-normal text-sm shadow-sm placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-slate-50/50 dark:bg-slate-700/30 border-b border-gray-100 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-[23%]">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-[27%]">Organization</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-[10%]">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-[12%]">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-[13%]">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {(filteredUsers || []).map((user) => {
                  const displayOrg = user.organization || 'Not Specified';

                  return (
                    <tr key={user.id} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-all duration-200 group">
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-gray-300 font-semibold group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors truncate">{user.email}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-gray-400 font-medium uppercase tracking-wide whitespace-nowrap">{displayOrg}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-xs font-semibold border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer hover:border-purple-300 dark:hover:border-purple-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border shadow-sm ${user.is_approved
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : user.is_active === false
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                          {user.is_approved ? 'Approved' : user.is_active === false ? 'Declined' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                          {user.is_approved ? (
                            <button
                              onClick={() => handleDecline(user.id)}
                              className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-all active:scale-95"
                            >
                              Decline
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApprove(user.id)}
                              className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg transition-all active:scale-95"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showLogsModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowLogsModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border dark:border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">System Access Logs</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Audit trail of user login activities</p>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto flex-1 p-0">
              {loadingLogs ? (
                <div className="text-center py-12 text-gray-500">Loading logs...</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User Email</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                    {(accessLogs || []).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(log.timestamp + 'Z').toLocaleString('en-GB')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">
                          {log.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {log.role || 'USER'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${log.action.includes('LOGIN') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {log.action}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {(accessLogs || []).length === 0 && !loadingLogs && (
                <div className="text-center py-12 text-gray-500">
                  No logs found.
                </div>
              )}
            </div>
            {/* Footer with Clear Button */}
            <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between">
              <button
                onClick={handleClearLogs}
                className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shadow-sm"
              >
                Clear Logs
              </button>
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div >
        </div >,
        document.body
      )
      }
    </div >
  );
}
export default AdminDashboardPage;
