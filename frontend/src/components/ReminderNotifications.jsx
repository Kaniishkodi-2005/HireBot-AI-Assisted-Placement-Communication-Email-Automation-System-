import { useState, useEffect } from 'react';
import { checkPendingReminders, markReminderFulfilled, generateReminderDraft, sendEmail } from '../services/hrService';
import http from '../services/httpClient';
import ReminderDraftModal from './ReminderDraftModal';

function ReminderNotifications({ onClose, onCountChange }) {
  const [pendingReminders, setPendingReminders] = useState([]);
  const [visitReminders, setVisitReminders] = useState([]);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [draftEmail, setDraftEmail] = useState(null);
  const [recentlyFulfilled, setRecentlyFulfilled] = useState(null);
  const [lastVisitCount, setLastVisitCount] = useState(0);

  useEffect(() => {
    checkReminders();
    // Check every 5 minutes
    const interval = setInterval(() => {
      checkReminders();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkReminders = async () => {
    try {
      const reminders = await checkPendingReminders();

      // Split into Visits and General Reminders
      const visits = reminders.filter(r =>
        r.description.toLowerCase().includes('visit') ||
        (r.due_date_str && r.due_date_str.toLowerCase().includes('visit'))
      );

      // Play sound if we have new urgent visits (today/tomorrow)
      const urgentVisits = visits.filter(r => r.is_today || r.is_tomorrow).length;
      // Sound disabled
      setLastVisitCount(urgentVisits);

      const others = reminders.filter(r =>
        !r.description.toLowerCase().includes('visit') &&
        (!r.due_date_str || !r.due_date_str.toLowerCase().includes('visit'))
      );

      setVisitReminders(visits);
      setPendingReminders(others);
      updateTotalCount(others.length, visits.length);
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    }
  };

  // Deprecated: checkVisitReminders merged above

  const updateTotalCount = (overdueCount, visitCount) => {
    if (onCountChange) {
      onCountChange(overdueCount + visitCount);
    }
  };

  const handleMarkFulfilled = async (reminderId) => {
    const confirmed = window.confirm('Are you sure you want to mark this reminder as fulfilled?');
    if (!confirmed) return;

    try {
      await markReminderFulfilled(reminderId);

      // Find the fulfilled reminder for undo functionality
      const fulfilledReminder = [...pendingReminders, ...visitReminders].find(r => r.id === reminderId);

      // Remove from both regular reminders and visit reminders
      const updatedReminders = pendingReminders.filter(r => r.id !== reminderId);
      const updatedVisits = visitReminders.filter(r => r.id !== reminderId);
      setPendingReminders(updatedReminders);
      setVisitReminders(updatedVisits);
      updateTotalCount(updatedReminders.length, updatedVisits.length);

      // Set up undo option
      setRecentlyFulfilled(fulfilledReminder);
      setTimeout(() => setRecentlyFulfilled(null), 10000); // Clear after 10 seconds
    } catch (error) {
      console.error('Failed to mark reminder as fulfilled:', error);
    }
  };

  const handleSendReminder = async (reminder) => {
    try {
      console.log('Generating reminder draft for:', reminder);
      const draft = await generateReminderDraft(reminder.id);
      console.log('Draft generated:', draft);

      // Check if it's a date restriction error
      if (draft.error === 'date_restriction') {
        alert(`⚠️ Reminder Draft Unavailable\n\n${draft.message}`);
        return;
      }

      setSelectedReminder(reminder);
      setDraftEmail(draft);
      setShowDraftModal(true);
    } catch (error) {
      console.error('Failed to generate reminder draft:', error);
      alert('Failed to generate reminder draft. Please try again.');
    }
  };

  const handleApproveDraft = async (approvedDraft) => {
    try {
      const result = await sendEmail(selectedReminder.contact_id, approvedDraft);

      // Check if the result indicates an error
      if (result.error || result.status === "failed") {
        alert(`Failed to send email: ${result.error || result.message || "Unknown error"}`);
        return;
      }

      // Success - email sent, but don't mark as fulfilled automatically
      // The reminder should remain active until manually marked as fulfilled

      // Close modal and show success
      setShowDraftModal(false);
      setSelectedReminder(null);
      setDraftEmail(null);

      alert(`✅ Reminder email sent successfully to ${selectedReminder.contact_name}!`);

      // Refresh the reminders list to ensure it's up to date
      checkReminders();

    } catch (error) {
      console.error('Failed to send reminder email:', error);
      const errorMessage = error.response?.data?.error ||
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message ||
        "Failed to send email";
      alert(`❌ Error: ${errorMessage}`);
    }
  };

  const handleUndoFulfilled = async () => {
    if (!recentlyFulfilled) return;

    try {
      console.log('Attempting to restore reminder:', recentlyFulfilled.id);
      // Call API to restore reminder
      await http.put(`/hr/reminders/${recentlyFulfilled.id}/restore`);
      console.log('Reminder restored successfully');

      // Refresh the entire reminders list to get proper sorting
      await checkReminders();

      setRecentlyFulfilled(null);
      console.log('Undo completed successfully');
    } catch (error) {
      console.error('Failed to undo reminder fulfillment:', error);
      alert('Failed to undo. Please try again.');
    }
  };

  const dismissVisitReminder = (id) => {
    const updatedVisits = visitReminders.filter(n => n.id !== id);
    setVisitReminders(updatedVisits);
    updateTotalCount(pendingReminders.length, updatedVisits.length);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col transition-colors duration-200">
        <div className="bg-purple-50 dark:bg-slate-800 border-b border-purple-200 dark:border-slate-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <h4 className="text-lg font-semibold text-purple-800 dark:text-purple-300">Reminders & Commitments</h4>
          </div>
          <button
            onClick={onClose}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Undo notification */}
          {recentlyFulfilled && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="text-sm text-green-800 dark:text-green-300">
                  Marked "{recentlyFulfilled.description}" as fulfilled
                </span>
              </div>
              <button
                onClick={handleUndoFulfilled}
                className="text-sm text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 font-medium underline"
              >
                Undo
              </button>
            </div>
          )}
          {pendingReminders.length === 0 && visitReminders.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium">No reminders</p>
              <p className="text-sm mt-1">All commitments are up to date!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Visit Reminders */}
              {visitReminders.map((notification) => (
                <div key={`visit-${notification.id}`} className={`rounded-lg p-4 border ${notification.is_today || notification.is_tomorrow
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                  : 'bg-purple-50 dark:bg-slate-700/50 border-purple-200 dark:border-slate-600'
                  }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${notification.is_today || notification.is_tomorrow
                      ? 'bg-red-500'
                      : 'bg-purple-500'
                      }`}></div>
                    <h4 className={`text-sm font-semibold ${notification.is_today || notification.is_tomorrow
                      ? 'text-red-800 dark:text-red-300'
                      : 'text-purple-800 dark:text-purple-300'
                      }`}>
                      {notification.is_today ? '🔔 Today\'s Visit' :
                        notification.is_tomorrow ? '⏰ Tomorrow\'s Visit' :
                          `📅 Upcoming: ${notification.deadline_text}`}
                    </h4>
                    {(notification.is_today || notification.is_tomorrow) && (
                      <span className="text-lg ml-auto">🚨</span>
                    )}
                  </div>

                  <div className="text-base text-gray-800 dark:text-gray-200 mb-2">
                    <strong>{notification.company_name}</strong> - {notification.contact_name}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {notification.description}
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleMarkFulfilled(notification.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors duration-200 shadow-sm border border-green-200 dark:border-green-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Fulfilled
                    </button>
                    <button
                      onClick={() => handleSendReminder(notification)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors duration-200 shadow-sm border border-blue-200 dark:border-blue-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Draft Reminder
                    </button>
                  </div>
                </div>
              ))}

              {/* Overdue / Other Reminders */}
              {pendingReminders.map((reminder) => (
                <div key={`reminder-${reminder.id}`} className="bg-violet-50 dark:bg-slate-700/50 rounded-lg p-4 border border-violet-200 dark:border-slate-600">
                  <div className="text-sm text-violet-700 dark:text-purple-300 font-medium mb-2">
                    {reminder.contact_name} • {reminder.company_name}
                  </div>
                  <div className="text-base text-gray-800 dark:text-gray-200 mb-2">
                    {reminder.description}
                  </div>
                  <div className="text-sm text-violet-600 dark:text-purple-300/80 mb-3">
                    Due: {reminder.deadline_text}
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleMarkFulfilled(reminder.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors duration-200 shadow-sm border border-green-200 dark:border-green-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Fulfilled
                    </button>
                    <button
                      onClick={() => handleSendReminder(reminder)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors duration-200 shadow-sm border border-blue-200 dark:border-blue-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Draft Reminder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDraftModal && selectedReminder && draftEmail && (
        <ReminderDraftModal
          reminder={selectedReminder}
          draft={draftEmail}
          onClose={() => {
            setShowDraftModal(false);
            setSelectedReminder(null);
            setDraftEmail(null);
          }}
          onApprove={handleApproveDraft}
        />
      )}
    </div>
  );
}

export default ReminderNotifications;