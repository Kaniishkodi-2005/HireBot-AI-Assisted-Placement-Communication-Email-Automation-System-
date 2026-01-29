import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHrContacts, uploadHrCsv, generateDraft, fetchConversation, syncConversation, sendEmail, sendFollowUp, checkFollowUps, fetchReceivedEmails, resetAllStatuses, syncAllStatuses, createTemplate, deleteTemplate, testHrParsing, generateAiDraft, createReminder, checkPendingReminders, getHrReplyNotifications, dismissHrReplyNotification, checkForNewHrReplies, createNotificationsForAllReplies, clearAllNotifications } from "../services/hrService";
import Notification from "../components/Notification";
import EmailConversationModal from "../components/EmailConversationModal";
import TemplateSelectionModal from "../components/TemplateSelectionModal";
import EmailConfirmationModal from "../components/EmailConfirmationModal";
import CreateTemplateModal from "../components/CreateTemplateModal";
import ReminderNotifications from "../components/ReminderNotifications";
import HrReplyNotification from "../components/HrReplyNotification";
import Pagination from "../components/Pagination";
import "../components/HrReplyNotification.css";
import http from "../services/httpClient";

function HrDashboardPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [company, setCompany] = useState("");
  const [parsed, setParsed] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateContact, setTemplateContact] = useState(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showRemindersPanel, setShowRemindersPanel] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [visitReminders, setVisitReminders] = useState([]);
  const [draftingContactId, setDraftingContactId] = useState(null);
  const [hrReplyNotifications, setHrReplyNotifications] = useState([]);
  const itemsPerPage = 9;

  const handleViewConversation = async (contact) => {
    console.log('Opening conversation for contact (instant):', contact.id);

    // Dismiss any notifications for this contact when viewing conversation
    const contactNotifications = hrReplyNotifications.filter(n => n.contact.id === contact.id);

    // Update localStorage to remember these are dismissed even if backend sends them again
    const dismissedIds = new Set(JSON.parse(localStorage.getItem('dismissedHrNotifications') || '[]'));

    for (const notification of contactNotifications) {
      await dismissHrReplyNotification(notification.id);
      dismissedIds.add(notification.id);
    }
    localStorage.setItem('dismissedHrNotifications', JSON.stringify([...dismissedIds]));

    setHrReplyNotifications(prev => prev.filter(n => n.contact.id !== contact.id));

    try {
      // 1. Fetch cached data immediately and open modal
      const initialData = await fetchConversation(contact.id);
      setSelectedContact({
        ...contact,
        conversation: initialData.conversations || []
      });

      // 2. Trigger sync in background (non-blocking)
      console.log('Starting background sync...');
      syncConversation(contact.id).then(async () => {
        console.log('Background sync complete, refreshing data...');
        const updatedData = await fetchConversation(contact.id);

        // Refresh reminder count in case auto-extraction found something
        checkPendingReminders().then(data => setReminderCount(data.length));

        // Only update if we're still looking at the same contact
        setSelectedContact(prev => {
          if (prev && prev.id === contact.id) {
            return {
              ...prev,
              conversation: updatedData.conversations || []
            };
          }
          return prev;
        });

        // Refresh contacts list in background to update statuses
        loadContacts();
      }).catch(err => {
        console.error('Background sync failed:', err);
      });

    } catch (error) {
      console.error('Failed to open conversation:', error);
      const errorMsg = error.response?.data?.detail || error.message || "Unknown error";
      setNotification({ message: `Error: ${errorMsg}`, type: "error" });
    }
  };

  const handleDraftClick = (contact) => {
    console.log('Selected contact:', contact);
    setTemplateContact(contact);
    setShowTemplateModal(true);
  };

  const handleAiDraft = async (contact) => {
    console.log('=== AI DRAFT BUTTON CLICKED ===');
    console.log('Contact:', contact);
    setDraftingContactId(contact.id);
    try {
      // 1. Get the latest conversation data from DB first
      let conversationData = await fetchConversation(contact.id);
      let allMessages = conversationData.conversations || [];

      // Sort messages by timestamp just to be safe
      allMessages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

      // Check if the very last message was sent by us
      if (allMessages.length > 0) {
        const lastMessage = allMessages[allMessages.length - 1];
        if (lastMessage.direction === 'sent') {
          // Alert the user and stop
          const confirmGen = window.confirm(
            "The latest message in this conversation was sent by YOU.\n\n" +
            "It seems you have already replied. Are you sure you want to generate another draft based on the previous HR email?"
          );

          if (!confirmGen) {
            setDraftingContactId(null);
            return;
          }
        }
      }

      let hrReplies = allMessages.filter(c => c.direction === 'received');

      // 2. Only sync if no replies exist in DB
      if (hrReplies.length === 0) {
        setNotification({ message: "Syncing latest emails...", type: "info" });
        try {
          await syncConversation(contact.id);
          // Re-fetch after sync
          conversationData = await fetchConversation(contact.id);
          allMessages = conversationData.conversations || [];
          hrReplies = allMessages.filter(c => c.direction === 'received');
        } catch (syncErr) {
          console.warn("Sync failed, proceeding with cached data:", syncErr);
        }
      }

      // Check again after sync
      if (allMessages.length > 0) {
        const lastMessage = allMessages[allMessages.length - 1];
        // If we just synced and found a sent message at the end, warn again? 
        // Maybe overkill, but safe. Let's just trust the first check + sync logic.
        // Actually, if sync found a new SENT message, we should probably warn.
        // But usually sync fetches INBOX mostly?
        // Let's stick to the initial check for now to avoid complexity.
      }

      const latestReply = hrReplies.length > 0 ? hrReplies[hrReplies.length - 1] : null;

      console.log('=== HR REPLIES DEBUG ===');
      console.log('Total HR replies found:', hrReplies.length);
      hrReplies.forEach((reply, idx) => {
        console.log(`Reply ${idx + 1}:`, {
          timestamp: reply.timestamp || reply.sent_at,
          subject: reply.subject,
          content: reply.content?.substring(0, 100) + '...'
        });
      });
      console.log('Selected latest reply:', {
        subject: latestReply?.subject,
        content: latestReply?.content?.substring(0, 100) + '...'
      });
      console.log('========================');

      if (!latestReply) {
        setNotification({
          message: "No HR reply found. Please ensure you have received an email from this contact.",
          type: "warning"
        });
        setDraftingContactId(null);
        return;
      }

      setNotification({ message: "Generating AI draft based on latest reply...", type: "info" });

      const hrReplyContent = latestReply.content;
      console.log('Using latest HR Reply for draft:', hrReplyContent);

      // 3. Call generateAiDraft with the actual content
      const aiDraft = await generateAiDraft(contact.id, hrReplyContent, true);

      console.log('AI Draft received:', aiDraft);
      setEmailDraft(aiDraft);
      setTemplateContact(contact);
      setShowEmailConfirm(true);
      setNotification(null);
    } catch (error) {
      console.error('=== AI DRAFT ERROR ===');
      const errorMsg = error.response?.data?.detail || error.message || "Failed to generate AI draft";
      setNotification({ message: "Error: " + errorMsg, type: "error" });
      // CRITICAL: Alert the user so they can see the error even if UI refreshes
      window.alert("AI Draft Error: " + errorMsg);
    } finally {
      setDraftingContactId(null);
    }
  };


  const handleTemplateSelect = async (template) => {
    console.log('Template selected:', template);
    try {
      let draft;

      // Create proper content for built-in templates
      if (template.id === 'final_year_students') {
        draft = {
          subject: `Placement Opportunity - Final Year Students | ${templateContact.company}`,
          content: `Dear ${templateContact.name || 'Hiring Team'},\n\nGreetings from the Placement Cell!\n\nWe are pleased to introduce our final year students for placement opportunities at ${templateContact.company}. Our students demonstrate exceptional academic performance and technical proficiency.\n\nWe would appreciate receiving your detailed job requirements to ensure precise candidate matching. This will enable us to shortlist the most suitable candidates for your consideration.\n\nLooking forward to a successful collaboration.\n\nBest regards,\nPlacement Officer`,
          to: templateContact.email,
          from: 'bitplacement28@gmail.com'
        };
      } else if (template.id === 'internship_opportunities') {
        draft = {
          subject: `Summer Internship Collaboration | ${templateContact.company}`,
          content: `Dear ${templateContact.name || 'Hiring Team'},\n\nWe hope this email finds you well.\n\nWe are writing to explore internship opportunities at ${templateContact.company} for our pre-final year students. Our students are eager to gain practical experience and contribute to your organization.\n\nWe would be grateful if you could share details about available internship positions and the application process.\n\nThank you for your time and consideration.\n\nBest regards,\nPlacement Officer`,
          to: templateContact.email,
          from: 'bitplacement28@gmail.com'
        };
      } else if (template.id === 'follow_up') {
        draft = {
          subject: `Follow-up: Placement Requirements | ${templateContact.company}`,
          content: `Dear ${templateContact.name || 'Team'},\n\nI hope this email finds you well.\n\nThis is a follow-up regarding our previous communication about placement opportunities at ${templateContact.company}. We remain committed to providing you with qualified candidates.\n\nWe would appreciate an update on your current hiring requirements.\n\nThank you for your time and consideration.\n\nBest regards,\nPlacement Officer`,
          to: templateContact.email,
          from: 'bitplacement28@gmail.com'
        };
      } else {
        // Handle custom templates
        draft = {
          subject: template.subject || 'No Subject',
          content: (template.body || '').replace(/{company_name}/g, templateContact.company || 'Company').replace(/{contact_name}/g, templateContact.name || 'Hiring Team'),
          to: templateContact.email,
          from: 'bitplacement28@gmail.com'
        };
      }

      console.log('Draft created:', draft);
      setEmailDraft(draft);
      setShowTemplateModal(false);
      setShowEmailConfirm(true);
    } catch (error) {
      console.error('Template selection error:', error);
      setNotification({ message: "Failed to generate draft: " + error.message, type: "error" });
    }
  };

  const handleSendEmail = async (emailData) => {
    if (!templateContact) {
      setNotification({ message: "No contact selected", type: "error" });
      return;
    }

    try {
      const result = await sendEmail(templateContact.id, emailData);

      // Check if the result indicates an error
      if (result.error || result.status === "failed") {
        setNotification({
          message: result.error || result.message || "Failed to send email",
          type: "error"
        });
        return;
      }

      setNotification({ message: result.message || "Email sent successfully!", type: "success" });
      setShowEmailConfirm(false);
      setEmailDraft(null);

      // Refresh conversation if modal is open
      if (selectedContact && selectedContact.id === templateContact.id) {
        const conversationData = await fetchConversation(templateContact.id);
        setSelectedContact({
          ...templateContact,
          conversation: conversationData.conversations || conversationData || []
        });
      }

      setTemplateContact(null);
      await loadContacts();
    } catch (error) {
      console.error("Email sending error:", error);
      const errorMessage = error.response?.data?.error ||
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message ||
        "Failed to send email";
      setNotification({
        message: errorMessage,
        type: "error"
      });
    }
  };


  const handleBackToTemplates = () => {
    setShowEmailConfirm(false);
    setShowTemplateModal(true);
  };

  const handleCreateTemplate = () => {
    setShowTemplateModal(false);
    setShowCreateTemplate(true);
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      await createTemplate(templateData);
      setShowCreateTemplate(false);
      setShowTemplateModal(true);
    } catch (error) {
      console.error('Failed to save template:', error);
      setShowCreateTemplate(false);
      setShowTemplateModal(true);
    }
  };



  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await fetchHrContacts();
      setContacts(data);
      setFilteredContacts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial sync of statuses to ensure they match conversation history
    syncAllStatuses().then(() => loadContacts()).catch(err => console.error("Initial status sync failed:", err));

    loadContacts();

    // Initial reminder count fetch (fix persistence display)
    checkPendingReminders().then(data => {
      setReminderCount(data.length);
      // Filter visit reminders for alert emoji
      const visits = data.filter(r =>
        r.description.toLowerCase().includes('visit') ||
        (r.due_date_str && r.due_date_str.toLowerCase().includes('visit'))
      );
      setVisitReminders(visits);
    }).catch(err => console.error("Initial reminder fetch failed:", err));

    // Load existing HR reply notifications (keep them persistent)
    getHrReplyNotifications().then(data => {
      setHrReplyNotifications(data.notifications || []);
    }).catch(err => console.error("Initial notification fetch failed:", err));

    // Background polling using Web Worker (prevents throttling in background tabs)
    const worker = new Worker('/pollingWorker.js');
    const isSyncingRef = { current: false };

    worker.onmessage = async (e) => {
      if (e.data === 'tick') {
        if (isSyncingRef.current) return; // Skip if previous sync is still running
        isSyncingRef.current = true;

        console.log('Worker tick: Starting background sync...');

        try {
          // 1. Sync Emails
          await fetchReceivedEmails();

          // 2. Refresh contacts and reminder count
          // Don't await loadContacts purely to parallelize, but here we need sequential to be safe? 
          // loadContacts updates state, so it's async-ish.
          loadContacts();

          // 3. Check for New Notifications
          const notifData = await checkForNewHrReplies();
          if (notifData && notifData.new_notifications && notifData.new_notifications.length > 0) {
            setHrReplyNotifications(prev => {
              const existingEmailIds = new Set(prev.map(n => n.email_id));
              const newUniqueNotifications = notifData.new_notifications.filter(
                n => !existingEmailIds.has(n.email_id)
              );
              return [...prev, ...newUniqueNotifications];
            });
          }

          // 4. Update Reminders
          const reminderData = await checkPendingReminders();
          if (reminderData) {
            setReminderCount(reminderData.length);
            const visits = reminderData.filter(r =>
              r.description.toLowerCase().includes('visit') ||
              (r.due_date_str && r.due_date_str.toLowerCase().includes('visit'))
            );
            setVisitReminders(visits);
          }
        } catch (err) {
          console.error('Background sync failed:', err);
        } finally {
          isSyncingRef.current = false;
        }
      }
    };

    // Start the worker
    worker.postMessage('start');

    return () => {
      worker.postMessage('stop');
      worker.terminate();
    };
  }, []);

  // Filter contacts based on search
  useEffect(() => {
    let filtered = [...contacts];

    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredContacts(filtered);
    setCurrentPage(1);
  }, [searchQuery, contacts]);

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      const result = await uploadHrCsv(file, true, false);
      setNotification({
        message: `Successfully uploaded ${result.length} HR contact(s)!`,
        type: "success"
      });
      await loadContacts();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || "Upload failed. Please check the file format.";
      setNotification({
        message: errorMsg,
        type: "error"
      });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleParseEmail = async () => {
    if (!company || !emailText) return;
    const result = await parseHrEmail(company, emailText);
    setParsed(result);
  };

  // Pagination
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get status badge color
  const getStatusColor = (status) => {
    if (!status) return "bg-slate-200 text-slate-700";
    const lower = status.toLowerCase();
    if (lower.includes("replied") || lower.includes("positive") || lower.includes("interest")) {
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    }
    if (lower.includes("awaiting") || lower.includes("pending")) {
      return "bg-amber-100 text-amber-700 border border-amber-200";
    }
    if (lower.includes("bounced") || lower.includes("failed")) {
      return "bg-red-100 text-red-700 border border-red-200";
    }
    return "bg-slate-200 text-slate-700 border border-slate-200";
  };

  const totalContacts = contacts.length;
  const unrepliedContacts = contacts.filter((c) =>
    c.email_status?.toLowerCase().includes("awaiting") ||
    c.email_status?.toLowerCase().includes("pending") ||
    c.email_status?.toLowerCase().includes("sent")
  ).length;
  const repliedContacts = contacts.filter((c) =>
    c.email_status?.toLowerCase().includes("replied")
  ).length;
  const notStartedContacts = contacts.filter((c) =>
    !c.email_status || c.email_status?.toLowerCase().includes("not started")
  ).length;

  // HR Reply Notification Handlers
  const handleDismissNotification = async (notificationId) => {
    try {
      await dismissHrReplyNotification(notificationId);
      setHrReplyNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  return (
    <div className="space-y-6 min-h-screen bg-gray-50">
      {showRemindersPanel && (
        <ReminderNotifications
          onClose={() => setShowRemindersPanel(false)}
          onCountChange={setReminderCount}
        />
      )}

      {notification && (
        <div className="fixed bottom-4 right-4 z-50">
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        </div>
      )}

      {selectedContact && (
        <EmailConversationModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onRefresh={handleViewConversation}
        />
      )}

      {showTemplateModal && (
        <TemplateSelectionModal
          key={showCreateTemplate ? 'refresh' : 'normal'}
          contact={templateContact}
          onClose={() => {
            setShowTemplateModal(false);
            setTemplateContact(null);
          }}
          onTemplateSelect={handleTemplateSelect}
          onCreateTemplate={handleCreateTemplate}
          onDeleteTemplate={async (templateId) => {
            try {
              await deleteTemplate(templateId);
            } catch (error) {
              console.error('Failed to delete template:', error);
            }
          }}
        />
      )}

      {showCreateTemplate && (
        <CreateTemplateModal
          onClose={() => setShowCreateTemplate(false)}
          onSave={handleSaveTemplate}
        />
      )}

      {showEmailConfirm && emailDraft && templateContact && (
        <EmailConfirmationModal
          draft={emailDraft}
          contact={templateContact}
          onClose={() => {
            setShowEmailConfirm(false);
            setEmailDraft(null);
            // Don't clear templateContact here to preserve it for sending
          }}
          onSend={handleSendEmail}
          onBack={handleBackToTemplates}
        />
      )}
      {/* HR Reply Notifications - positioned before header */}
      <HrReplyNotification
        notifications={hrReplyNotifications}
        onDismiss={handleDismissNotification}
      />

      {/* Header Section */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">HR Directory</h2>
          <p className="text-slate-500 text-sm">Manage corporate relations and track AI-analyzed communications</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload (CSV/Excel)
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => navigate("/dashboard/hr/edit")}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        </div>
      </header>



      {/* Summary Cards */}
      <section className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div className="absolute top-4 right-4">
            <span className="text-3xl text-gray-400">👥</span>
          </div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Total HR Contacts</p>
          <p className="text-4xl font-bold text-slate-800">{totalContacts}</p>
        </div>
        <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div className="absolute top-4 right-4">
            <span className="text-3xl text-gray-400">📝</span>
          </div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Not Started</p>
          <p className="text-4xl font-bold text-slate-800">{notStartedContacts}</p>
        </div>
        <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div className="absolute top-4 right-4">
            <span className="text-3xl text-gray-400">⏰</span>
          </div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Unreplied</p>
          <p className="text-4xl font-bold text-slate-800">{unrepliedContacts}</p>
        </div>
        <div className="bg-white rounded-xl p-6 relative overflow-hidden group transition-all duration-300" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div className="absolute top-4 right-4">
            <span className="text-3xl text-gray-400">✉️</span>
          </div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Replied</p>
          <p className="text-4xl font-bold text-slate-800">{repliedContacts}</p>
        </div>
      </section>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg pl-12 pr-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
          />
        </div>
      </div>

      {/* Contact Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-slate-500 animate-pulse">Loading contacts...</p>
        </div>
      ) : paginatedContacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="flex flex-col items-center justify-center text-slate-400">
            <p>No HR contacts found.</p>
            <p className="text-sm mt-1">Upload a CSV or Excel file to get started.</p>
          </div>
        </div>
      ) : (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">HR Contacts</h3>
              <p className="text-sm text-slate-500 mt-1">
                Showing {filteredContacts.length} contact(s)
              </p>
            </div>
            <button
              onClick={() => setShowRemindersPanel(!showRemindersPanel)}
              className="relative px-5 py-3 rounded-lg font-semibold text-base shadow-md transition-all flex items-center gap-2 text-white"
              style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}
            >
              {/* Show alert emoji for urgent visits OR bell icon for regular reminders */}
              {visitReminders.some(r => r.is_today || r.is_tomorrow) ? (
                <span className="text-2xl animate-pulse">🚨</span>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
              Reminders
              {reminderCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {reminderCount}
                </span>
              )}
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {paginatedContacts.map((c) => (
              <div
                key={c.id}
                className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 p-5 hover:border-slate-300"
              >
                {/* Header with Avatar and Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ background: 'linear-gradient(135deg, #6366F1, #9333EA)' }}>
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate uppercase">{c.name}</h3>
                    <p className="text-gray-600 font-medium text-xs truncate">{c.company}</p>
                  </div>
                  {/* Reply Status Badge */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${c.email_status?.toLowerCase().includes('replied') || c.email_status?.toLowerCase().includes('positive')
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                    {c.email_status?.toLowerCase().includes('replied') || c.email_status?.toLowerCase().includes('positive')
                      ? '✓ REPLIED'
                      : '○ PENDING'
                    }
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-4 truncate">{c.email}</p>

                {/* Status Information */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Email:</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(c.email_status)}`}>
                      {c.email_status || "Not Started"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Draft:</span>
                    <span className="text-xs text-gray-700 font-medium">{c.draft_status || "Not Started"}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewConversation(c)}
                      className="flex-[3] px-3 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md"
                      style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}
                    >
                      View Conversation
                    </button>
                    <button
                      onClick={() => handleDraftClick(c)}
                      className="flex-1 px-3 py-2 border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-lg text-xs font-semibold transition-all"
                    >
                      Draft
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAiDraft(c)}
                      disabled={draftingContactId === c.id}
                      className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-xs font-bold transition-all shadow-sm border border-purple-100 flex items-center justify-center gap-1"
                    >
                      {draftingContactId === c.id ? (
                        <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span style={{ color: '#9333ea' }}>✨</span>
                      )}
                      {draftingContactId === c.id ? "Drafting..." : "AI Draft"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )
      }

      {/* Premium Pagination */}
      {filteredContacts.length > itemsPerPage && (
        <div className="pb-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div >
  );
}

export default HrDashboardPage;