import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { Users, MessageSquare, Clock, CheckCircle } from "lucide-react";

function HrDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const isSyncingRef = useRef(false);

  // Handle auto-opening conversation from notification click
  useEffect(() => {
    if (location.state?.openContactId && contacts.length > 0) {
      const contactId = location.state.openContactId;
      console.log("Auto-opening conversation for contact:", contactId);

      const targetContact = contacts.find(c => c.id === contactId);
      if (targetContact) {
        // Clear the state so it doesn't trigger again on refresh/back
        window.history.replaceState({}, document.title);
        handleViewConversation(targetContact);
      }
    }
  }, [location.state, contacts]); // dependency on contacts ensures it runs after contacts load

  const handleViewConversation = async (contact) => {
    console.log('Opening conversation for contact (instant):', contact.id);

    // NOTE: Notifications are NOT dismissed when viewing conversation
    // They will only be dismissed when explicitly closed by the user
    // const contactNotifications = hrReplyNotifications.filter(n => n.contact.id === contact.id);
    // const dismissedIds = new Set(JSON.parse(localStorage.getItem('dismissedHrNotifications') || '[]'));
    // for (const notification of contactNotifications) {
    //   await dismissHrReplyNotification(notification.id);
    //   dismissedIds.add(notification.id);
    // }
    // localStorage.setItem('dismissedHrNotifications', JSON.stringify([...dismissedIds]));
    // setHrReplyNotifications(prev => prev.filter(n => n.contact.id !== contact.id));

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

      const latestReply = hrReplies.length > 0 ? hrReplies[hrReplies.length - 1] : null;

      if (!latestReply) {
        setNotification({
          message: "No HR reply found. Please ensure you have received an email from this contact.",
          type: "warning"
        });
        setDraftingContactId(null);
        return;
      }

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
    } finally {
      setDraftingContactId(null);
    }
  };

  const handleTemplateSelect = async (template) => {
    if (!templateContact) return;

    try {
      let draft;

      // Check if this is a built-in template (has title/description) or custom template (has subject/body)
      const isBuiltInTemplate = template.title && template.description && !template.subject && !template.body;

      if (isBuiltInTemplate) {
        // Built-in template - needs AI generation from backend
        setNotification({ message: "Generating email from template...", type: "info" });

        try {
          const response = await generateDraft(templateContact.id, template.id);
          draft = {
            subject: response.subject || `Collaboration Opportunity - ${templateContact.company}`,
            content: response.body || response.content || '',
            to: templateContact.email,
            from: 'bitplacement28@gmail.com'
          };
          setNotification(null);
        } catch (error) {
          console.error('Failed to generate draft from template:', error);
          setNotification({
            message: "Failed to generate email from template. Please try again.",
            type: "error"
          });
          return;
        }
      } else {
        // Custom template - has subject and body already
        draft = {
          subject: (template.subject || '').replace(/{company_name}/g, templateContact.company || 'Company'),
          content: (template.body || template.content || '').replace(/{company_name}/g, templateContact.company || 'Company').replace(/{contact_name}/g, templateContact.name || 'Hiring Team'),
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

    const worker = new Worker('/pollingWorker.js');
    worker.onmessage = async (e) => {
      if (e.data === 'tick') {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;

        try {
          // 1. Fetch new emails
          try {
            await fetchReceivedEmails();
          } catch (err) {
            console.log("Email fetch failed", err);
          }

          // 2. Reload contacts to update statuses
          try {
            const data = await fetchHrContacts();
            setContacts(data);
          } catch (err) {
            console.log("Contact reload failed", err);
          }

          // 3. Check for new HR replies for notifications
          try {
            const notifResult = await checkForNewHrReplies();
            if (notifResult && notifResult.new_notifications && notifResult.new_notifications.length > 0) {
              console.log("New notifications found in background:", notifResult.new_notifications);
              setHrReplyNotifications(prev => {
                // De-duplicate
                const existingIds = new Set(prev.map(n => n.id));
                const newUnique = notifResult.new_notifications.filter(n => !existingIds.has(n.id));
                return [...prev, ...newUnique];
              });

              // Play sound for the FIRST new notification found in this batch if any
              playNotificationSound();
            }
          } catch (err) {
            console.log("Notification check failed", err);
          }

          // 4. Check reminders
          try {
            const reminders = await checkPendingReminders();
            setReminderCount(reminders.length);
            const visits = reminders.filter(r =>
              r.description.toLowerCase().includes('visit') ||
              (r.due_date_str && r.due_date_str.toLowerCase().includes('visit'))
            );
            setVisitReminders(visits);
          } catch (err) {
            console.log("Reminder check failed", err);
          }

        } catch (err) {
          console.error('Critical background sync error:', err);
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

  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Filter contacts based on search and status
  useEffect(() => {
    let filtered = [...contacts];

    // 1. Apply Status Filter
    if (filterStatus !== "All") {
      if (filterStatus === "Not Started") {
        filtered = filtered.filter(c => c.email_status === "Not Started");
      } else if (filterStatus === "Replied") {
        filtered = filtered.filter(c =>
          c.email_status?.toLowerCase().includes("replied") ||
          c.email_status?.toLowerCase().includes("positive") ||
          c.email_status?.toLowerCase().includes("interest")
        );
      } else if (filterStatus === "Pending") {
        filtered = filtered.filter(c =>
          c.email_status === 'Sent' ||
          c.email_status === 'Pending' ||
          (c.email_status && !c.email_status.toLowerCase().includes("replied") && c.email_status !== "Not Started")
        );
      }
    }

    // 2. Apply Search Filter
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
  }, [searchQuery, contacts, filterStatus]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && !event.target.closest('.filter-container')) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterDropdown]);

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

  const handleDismissNotification = async (notificationId) => {
    // Optimistically remove from UI
    setHrReplyNotifications(prev => prev.filter(n => n.id !== notificationId));

    // Call backend to mark as read
    try {
      await dismissHrReplyNotification(notificationId);
    } catch (err) {
      console.error("Failed to dismiss notification on backend:", err);
    }

    // Update local storage
    const dismissedIds = new Set(JSON.parse(localStorage.getItem('dismissedHrNotifications') || '[]'));
    dismissedIds.add(notificationId);
    localStorage.setItem('dismissedHrNotifications', JSON.stringify([...dismissedIds]));
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

  return (
    <div className="animate-fade-in">
      {/* Reminder Panel - conditionally rendered sidebar/overlay could go here */}
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


      {/* Header Section */}
      <header className="flex items-center justify-between font-sans mb-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white transition-colors">HR Directory</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm transition-colors">Manage corporate relations and track AI-analyzed communications</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 transform active:scale-95" style={{ backgroundColor: '#AF69F8' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Bulk Upload
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => navigate("/dashboard/hr/edit")}
            className="bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all flex items-center gap-2 transform active:scale-95"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manage
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid md:grid-cols-4 gap-6 mb-8 font-sans">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-purple-50/20 dark:hover:bg-purple-900/10 border border-transparent hover:border-purple-200 dark:hover:border-purple-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mt-2">Total HR Contacts</p>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <Users className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">{contacts.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-amber-50/20 dark:hover:bg-amber-900/10 border border-transparent hover:border-amber-200 dark:hover:border-amber-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mt-2">Not Started</p>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <MessageSquare className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{contacts.filter(c => c.email_status === 'Not Started').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-pink-50/20 dark:hover:bg-pink-900/10 border border-transparent hover:border-pink-200 dark:hover:border-pink-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors mt-2">Unreplied</p>
            <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <Clock className="w-5 h-5 text-pink-500 dark:text-pink-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-pink-700 dark:group-hover:text-pink-400 transition-colors">{contacts.filter(c => c.email_status === 'Sent' || c.email_status === 'Pending').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-emerald-50/20 dark:hover:bg-emerald-900/10 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900 cursor-pointer shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mt-2">Replied</p>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
              <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{contacts.filter(c => c.email_status?.toLowerCase().includes('replied')).length}</p>
        </div>
      </section>

      {/* Search and Filter Section */}
      <div className="flex items-center gap-4 mb-6 relative">
        <div className="relative filter-container">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`bg-white dark:bg-slate-800 border-2 hover:border-slate-200 dark:hover:border-slate-600 text-slate-700 dark:text-gray-300 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 whitespace-nowrap ${filterStatus !== 'All' ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-100 dark:border-slate-700'}`}
          >
            <svg className={`w-5 h-5 ${filterStatus !== 'All' ? 'text-purple-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {filterStatus === 'All' ? 'Filter' : filterStatus}
            {filterStatus !== 'All' && (
              <span onClick={(e) => { e.stopPropagation(); setFilterStatus('All'); }} className="ml-1 hover:text-purple-800 rounded-full p-0.5">
                ✕
              </span>
            )}
          </button>

          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1 z-50 animate-fade-in">
              {['All', 'Not Started', 'Pending', 'Replied'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setFilterStatus(status);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${filterStatus === status ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' : 'text-gray-700 dark:text-gray-300'
                    }`}
                >
                  {status}
                  {filterStatus === status && <span className="text-purple-600">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 rounded-xl pl-12 pr-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-slate-200 dark:focus:border-slate-600 transition-colors font-normal text-sm shadow-sm"
          />
        </div>

        <button
          onClick={() => setShowRemindersPanel(!showRemindersPanel)}
          className="relative text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 transform active:scale-95 whitespace-nowrap"
          style={{ backgroundColor: '#AF69F8' }}
        >
          {visitReminders.some(r => r.is_today || r.is_tomorrow) ? (
            <span className="text-xl animate-pulse">🚨</span>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          )}
          Reminders
          {reminderCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-sm">
              {reminderCount}
            </span>
          )}
        </button>
      </div>

      {/* Contact Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-slate-500 animate-pulse">Loading contacts...</p>
        </div>
      ) : paginatedContacts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center transition-colors">
          <div className="flex flex-col items-center justify-center text-slate-400 dark:text-gray-500">
            <p>No HR contacts found.</p>
            <p className="text-sm mt-1">Upload a CSV or Excel file to get started.</p>
          </div>
        </div>
      ) : (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-slide-up transition-colors">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">HR Contacts</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                Showing {filteredContacts.length} contact(s)
              </p>
            </div>
            {/* Reminders button was here, moved up to toolbar */}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {paginatedContacts.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 p-5 hover:-translate-y-1 hover:border-slate-200 dark:hover:border-slate-600 group"
              >
                {/* Header with Avatar and Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ background: 'linear-gradient(135deg, #AF69F8, #9333EA)' }}>
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate uppercase">{c.name}</h3>
                    <p className="text-gray-600 dark:text-gray-400 font-medium text-xs truncate">{c.company}</p>
                  </div>
                  {/* Reply Status Badge */}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${c.email_status?.toLowerCase().includes('replied') || c.email_status?.toLowerCase().includes('positive')
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600'
                    }`}>
                    {c.email_status?.toLowerCase().includes('replied') || c.email_status?.toLowerCase().includes('positive')
                      ? '✓ REPLIED'
                      : '○ PENDING'
                    }
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 truncate">{c.email}</p>

                {/* Status Information */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Email:</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(c.email_status)}`}>
                      {c.email_status || "Not Started"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Draft:</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{c.draft_status || "Not Started"}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewConversation(c)}
                      className="flex-[3] px-3 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md"
                      style={{ backgroundColor: '#AF69F8' }}
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
                      className="flex-1 px-3 py-2 bg-purple-50 dark:bg-[#E0C0FF] text-purple-600 dark:text-purple-900 hover:bg-purple-100 dark:hover:bg-[#d0a0ff] rounded-lg text-xs font-bold transition-all shadow-sm border border-purple-100 dark:border-purple-200 flex items-center justify-center gap-1"
                    >
                      {draftingContactId === c.id ? (
                        <span className="w-4 h-4 border-2 border-purple-600 dark:border-purple-800 border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span style={{ color: '#9333ea' }} className="dark:text-purple-800">✨</span>
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
      {
        filteredContacts.length > itemsPerPage && (
          <div className="pb-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )
      }
    </div >
  );
}

export default HrDashboardPage;
