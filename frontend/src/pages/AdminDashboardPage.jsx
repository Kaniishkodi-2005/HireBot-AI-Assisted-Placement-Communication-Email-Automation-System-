import { useState, useEffect } from "react";
import HrDashboardPage from "./HrDashboardPage";
import StudentDashboardPage from "./StudentDashboardPage";
import http from "../services/httpClient";

function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState("admin");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (activeTab === "admin") {
      loadUsers();
    }
  }, [activeTab]);

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

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === "admin"
              ? "text-white shadow-md"
              : "text-gray-700 hover:bg-gray-100"
              }`}
            style={activeTab === "admin" ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
          >
            <span className="mr-2">🔐</span>
            Admin Dashboard
          </button>
          <button
            onClick={() => setActiveTab("hr")}
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === "hr"
              ? "text-white shadow-md"
              : "text-gray-700 hover:bg-gray-100"
              }`}
            style={activeTab === "hr" ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
          >
            <span className="mr-2">👥</span>
            HR Contacts
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === "students"
              ? "text-white shadow-md"
              : "text-gray-700 hover:bg-gray-100"
              }`}
            style={activeTab === "students" ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
          >
            <span className="mr-2">🎓</span>
            Students
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "admin" && (
        <div className="space-y-6">
          {notification && (
            <div className={`p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {notification.message}
            </div>
          )}

          <header>
            <h2 className="text-3xl font-bold text-gray-900">Access Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Control who can access the system, manage user permissions, and approve registrations
            </p>
          </header>

          {/* Stats Cards */}
          {/* Stats Cards - Styles matched to HR Dashboard */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div className="absolute top-4 right-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Total Users</p>
              <p className="text-4xl font-bold text-slate-800">{users.length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div className="absolute top-4 right-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Active Users</p>
              <p className="text-4xl font-bold text-slate-800">{users.filter(u => u.is_approved && u.is_active).length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div className="absolute top-4 right-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Declined Users</p>
              <p className="text-4xl font-bold text-slate-800">{users.filter(u => !u.is_active).length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div className="absolute top-4 right-4">
                <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Pending Approval</p>
              <p className="text-4xl font-bold text-slate-800">{users.filter(u => !u.is_approved && u.is_active).length}</p>
            </div>
          </div>

          {/* User Management Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">User Accounts</h3>
              <p className="text-sm text-gray-600 mt-1">Approve, decline, or manage user access and roles</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => {
                      // Demo Data Mapping
                      let displayOrg = user.organization;
                      if (user.email.toLowerCase().includes('subhiksha')) {
                        displayOrg = "BANNARI AMMAN INSTITUTE OF TECHNOLOGY";
                      } else if (user.email.toLowerCase().includes('chikash')) {
                        displayOrg = "KARPAGAM INSTITUTE OF TECHNOLOGY";
                      } else if (!displayOrg || displayOrg === 'Google User') {
                        displayOrg = 'Internal Admin'; // Fallback for enterprise look
                      }

                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{user.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 uppercase tracking-tight">{displayOrg}</td>
                          <td className="px-6 py-4">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className="text-sm border border-gray-200 bg-gray-50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${user.is_approved
                              ? 'bg-[#ECFDF5] text-[#047857] border border-green-100' // Enterprise Green
                              : user.is_active === false
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                              }`}>
                              {user.is_approved ? 'Approved' : user.is_active === false ? 'Declined' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {user.is_approved ? (
                                <button
                                  onClick={() => handleDecline(user.id)}
                                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                                >
                                  Decline
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleApprove(user.id)}
                                  className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-white border border-emerald-200 rounded hover:bg-emerald-50 transition-colors"
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
        </div>
      )}

      {activeTab === "hr" && <HrDashboardPage />}
      {activeTab === "students" && <StudentDashboardPage />}
    </div>
  );
}

export default AdminDashboardPage;
