import http from "./httpClient";

export async function fetchHrContacts() {
  const res = await http.get("/hr/contacts");
  return res.data;
}

export async function uploadHrCsv(file, replaceMode = true, appendMode = false) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("replace_mode", replaceMode.toString());
  formData.append("append_mode", appendMode.toString());
  const res = await http.post("/hr/upload-csv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000 // 2 minutes for file uploads
  });
  return res.data;
}

export async function updateHrContact(id, data) {
  const res = await http.put(`/hr/contacts/${id}`, data);
  return res.data;
}

export async function deleteHrContact(id) {
  const res = await http.delete(`/hr/contacts/${id}`);
  return res.data;
}


export async function extractIntent(company, message) {
  const res = await http.post("/hr/extract-intent", {
    message: message,
    company: company
  });
  return res.data;
}

export async function analyzeHrMessage(message, context = null) {
  const res = await http.post("/hr/analyze-message", {
    message: message,
    context: context
  });
  return res.data;
}


export async function exportHrContactsExcel() {
  const res = await http.get("/hr/export-excel", {
    responseType: "blob"
  });
  return res.data;
}

export async function exportHrContactsCsv() {
  const res = await http.get("/hr/export-csv", {
    responseType: "blob"
  });
  return res.data;
}

export async function generateDraft(contactId, templateType) {
  const res = await http.post(`/hr/generate-draft/${contactId}`, {
    template_type: templateType
  });
  return res.data;
}

export async function fetchConversation(contactId) {
  const res = await http.get(`/hr/conversation/${contactId}`);
  return res.data;
}

export async function syncConversation(contactId) {
  const res = await http.get(`/hr/${contactId}/sync`, {
    timeout: 120000 // 2 minutes for email syncing
  });
  return res.data;
}

export async function sendEmail(contactId, emailData) {
  const res = await http.post(`/hr/send-email/${contactId}`, {
    subject: emailData.subject,
    content: emailData.content
  });
  return res.data;
}


export async function sendFollowUp(contactId) {
  const res = await http.post(`/hr/send-followup/${contactId}`);
  return res.data;
}

export async function fetchReceivedEmails() {
  const res = await http.post('/hr/fetch-emails', {}, {
    timeout: 120000 // 2 minutes for bulk email syncing
  });
  return res.data;
}

export async function clearConversations() {
  const res = await http.delete('/hr/clear-conversations');
  return res.data;
}

export async function resetAllStatuses() {
  const res = await http.post('/hr/reset-all-statuses');
  return res.data;
}

export async function syncAllStatuses() {
  const res = await http.post('/hr/sync-all-statuses');
  return res.data;
}

export async function checkFollowUps() {
  const res = await http.post('/hr/check-followups');
  return res.data;
}

export async function createTemplate(templateData) {
  const res = await http.post('/hr/templates', templateData);
  return res.data;
}

export async function deleteTemplate(templateId) {
  const res = await http.delete(`/hr/templates/${templateId}`);
  return res.data;
}

export async function fetchTemplates() {
  const res = await http.get('/hr/templates');
  return res.data;
}

export async function parseHrReply(emailContent) {
  // Mock response for testing - replace with real API call later
  const mockResult = {
    role: null,
    skills: emailContent.toLowerCase().includes('ai') ? ['AI'] : [],
    count: emailContent.match(/\d+/) ? parseInt(emailContent.match(/\d+/)[0]) : null,
    eligibility: null,
    salary: null,
    location: null,
    mode: null,
    type: null,
    duration: null,
    deadline: emailContent.includes('month') ? 'one month' : null,
    action_required: emailContent.includes('send') ? 'send shortlisted student list' : null,
    reminder_requested: false,
    additional_notes: ""
  };

  console.log('HR Parsing Result (Mock):', mockResult);
  return mockResult;

  // Uncomment when backend is ready:
  /*
  const res = await http.post('/hr/parse-reply', { 
    content: emailContent,
    instruction: 'Extract campus placement or internship requirements from the HR email below and return them in the specified JSON format.',
    model: 'phi3-mini-4k-instruct',
    schema: {
      role: null,
      skills: [],
      count: null,
      eligibility: null,
      salary: null,
      location: null,
      mode: null,
      type: null,
      duration: null,
      deadline: null,
      action_required: null,
      reminder_requested: false,
      additional_notes: ""
    }
  });
  console.log('HR Parsing Result:', res.data);
  return res.data;
  */
}

export async function generateAiDraft(contactId, hrReplyContent, includeStudents = false) {
  const res = await http.post('/hr/draft-reply', {
    contact_id: contactId,
    hr_message: hrReplyContent,
    include_students: includeStudents
  });
  return res.data;
}


export async function createReminder(contactId, reminderData) {
  const res = await http.post('/hr/reminders', {
    contact_id: contactId,
    ...reminderData
  });
  return res.data;
}

export async function checkPendingReminders() {
  const res = await http.get('/hr/reminders/pending');
  return res.data;
}

export async function markReminderFulfilled(reminderId) {
  const res = await http.put(`/hr/reminders/${reminderId}/fulfill`);
  return res.data;
}

export async function generateReminderDraft(reminderId) {
  const res = await http.post(`/hr/reminders/${reminderId}/draft`);
  return res.data;
}

export async function testHrParsing() {
  const testEmail = "We need 5 students with strong expertise in AI. Please send the shortlisted student list after one month.";
  return await parseHrReply(testEmail);
}

// HR Reply Notification Functions
export async function getHrReplyNotifications() {
  const res = await http.get('/hr/notifications');
  return res.data;
}

export async function dismissHrReplyNotification(notificationId) {
  const res = await http.post(`/hr/notifications/dismiss/${notificationId}`);
  return res.data;
}

export async function checkForNewHrReplies() {
  const res = await http.post('/hr/notifications/check');
  return res.data;
}

export async function createNotificationsForAllReplies() {
  const res = await http.post('/hr/notifications/create-all');
  return res.data;
}

export async function clearAllNotifications() {
  const res = await http.post('/hr/notifications/clear-all');
  return res.data;
}

export async function forceCheckNotifications() {
  const res = await http.post('/hr/notifications/force-check');
  return res.data;
}