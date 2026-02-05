import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHrContacts, uploadHrCsv } from "../services/hrService";
import Notification from "../components/Notification";
import CsvEditor from "../components/CsvEditor";

function EditHrContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await fetchHrContacts();
      setContacts(data);
    } catch (error) {
      setNotification({
        message: "Failed to load HR contacts",
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
      const file = new File([blob], 'hr_contacts.csv', { type: 'text/csv' });

      // Upload the CSV file
      const result = await uploadHrCsv(file, true, false);
      setNotification({
        message: `Successfully saved ${result.length} HR contact(s)!`,
        type: "success"
      });

      // Reload data
      await loadContacts();

      // Navigate back after 2 seconds
      setTimeout(() => {
        navigate("/dashboard/hr");
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

    const columns = ['name', 'company', 'email', 'email_status', 'draft_status'];
    const headers = columns.join(',');
    const rows = data.map(row =>
      columns.map(col => {
        let value = row[col];

        // Default status fields if missing (critical for preventing data loss on save)
        if ((col === 'email_status' || col === 'draft_status') && !value) {
          value = 'Not Started';
        }

        value = value || '';

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
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' }
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

      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Edit HR Contacts</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
            Edit HR contact data directly in the table below. Click "Save Changes" when done.
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard/hr")}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all text-white flex items-center gap-2 transform active:scale-95"
          style={{ backgroundColor: '#AF69F8' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
      </header>

      {loading && contacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading HR contacts...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-hb-card rounded-lg p-8 border border-gray-200 text-center">
          <p className="text-gray-600 mb-4">No HR contacts found. Upload a CSV or Excel file to get started.</p>
        </div>
      ) : (
        <CsvEditor
          data={contacts}
          columns={columns}
          onSave={handleSave}
          onCancel={() => navigate("/dashboard/hr")}
          title="Edit HR Contact Data"
          disableUppercase={true}
        />
      )}
    </div>
  );
}

export default EditHrContactsPage;
