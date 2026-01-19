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
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "admin"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="mr-2">🔐</span>
            Admin Dashboard
          </button>
          <button
            onClick={() => setActiveTab("hr")}
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "hr"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="mr-2">👥</span>
            HR Contacts
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "students"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
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
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {users.length}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Total Users</h3>
              </div>
              <p className="text-sm text-gray-600">Registered accounts in the system</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                  {users.filter(u => u.is_approved && u.is_active).length}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Active Users</h3>
              </div>
              <p className="text-sm text-gray-600">Approved and active accounts</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                  {users.filter(u => !u.is_active).length}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Declined Users</h3>
              </div>
              <p className="text-sm text-gray-600">Users declined by admin</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold">
                  {users.filter(u => !u.is_approved && u.is_active).length}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Pending Approval</h3>
              </div>
              <p className="text-sm text-gray-600">Users awaiting admin approval</p>
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
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.organization}</td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_approved 
                              ? 'bg-green-100 text-green-800' 
                              : user.is_active === false
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {user.is_approved ? '✓ Approved' : user.is_active === false ? '✗ Declined' : '⏳ Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                          <br />
                          <span className="text-xs text-gray-500">
                            {new Date(user.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {user.is_approved ? (
                              <button
                                onClick={() => handleDecline(user.id)}
                                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-20 transition-all duration-150"
                              >
                                Decline
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApprove(user.id)}
                                className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-20 transition-all duration-150"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
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
