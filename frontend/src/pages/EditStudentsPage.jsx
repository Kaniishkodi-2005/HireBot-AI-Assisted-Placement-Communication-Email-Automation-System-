import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchStudents, uploadStudentCsv } from "../services/studentService";
import Notification from "../components/Notification";
import CsvEditor from "../components/CsvEditor";

function EditStudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await fetchStudents();
      setStudents(data);
    } catch (error) {
      setNotification({
        message: "Failed to load students",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (editedData) => {
    setLoading(true);
    try {
      // Convert edited data to CSV format
      const csvContent = convertToCsv(editedData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], 'students.csv', { type: 'text/csv' });

      // Upload the CSV file
      const result = await uploadStudentCsv(file, true, false);
      setNotification({
        message: `Successfully saved ${result.length} student(s)!`,
        type: "success"
      });

      // Reload data
      await loadStudents();

      // Navigate back after 2 seconds
      setTimeout(() => {
        const { user } = JSON.parse(localStorage.getItem("hirebot_auth") || "{}");
        if (user?.role === "admin") {
          navigate("/dashboard/admin");
        } else {
          navigate("/dashboard/students");
        }
      }, 2000);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || "Failed to save changes";
      setNotification({
        message: errorMsg,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const convertToCsv = (data) => {
    if (!data || data.length === 0) return "";

    const columns = ['roll_no', 'name', 'department', 'domain', 'cgpa', 'skills_text'];
    const headers = columns.join(',');
    const rows = data.map(row =>
      columns.map(col => {
        const value = row[col] || '';
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [headers, ...rows].join('\n');
  };

  const columns = [
    { key: 'roll_no', label: 'Roll No', type: 'text' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'domain', label: 'Domain', type: 'text' },
    { key: 'cgpa', label: 'CGPA', type: 'number' },
    { key: 'skills_text', label: 'PS Level', type: 'text' }
  ];

  return (
    <div className="space-y-6">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Edit Students</h2>
          <p className="text-sm text-gray-600 mt-1">
            Edit student data directly in the table below. Click "Save Changes" when done.
          </p>
        </div>
        <button
          onClick={() => {
            const { user } = JSON.parse(localStorage.getItem("hirebot_auth") || "{}");
            if (user?.role === "admin") {
              navigate("/dashboard/admin");
            } else {
              navigate("/dashboard/students");
            }
          }}
          className="px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all text-white flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}
        >
          Back to Dashboard
        </button>
      </header>

      {loading && students.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading students...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-hb-card rounded-lg p-8 border border-gray-200 text-center">
          <p className="text-gray-600 mb-4">No students found. Upload a CSV or Excel file to get started.</p>
        </div>
      ) : (
        <CsvEditor
          data={students}
          columns={columns}
          onSave={handleSave}
          onCancel={() => {
            const { user } = JSON.parse(localStorage.getItem("hirebot_auth") || "{}");
            if (user?.role === "admin") {
              navigate("/dashboard/admin");
            } else {
              navigate("/dashboard/students");
            }
          }}
          title="Edit Student Data"
        />
      )}
    </div>
  );
}

export default EditStudentsPage;
