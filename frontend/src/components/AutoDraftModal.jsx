import { useState } from 'react';

function AutoDraftModal({ hrReply, contact, onClose, onSendDraft }) {
  const [draft, setDraft] = useState({
    subject: `Re: ${hrReply.subject || 'Your Email'}`,
    content: generateAutoResponse(hrReply.content, contact)
  });

  function generateAutoResponse(hrContent, contact) {
    // Simple auto-response based on HR content
    if (hrContent.toLowerCase().includes('follow') && hrContent.toLowerCase().includes('month')) {
      return `Dear ${contact.name},\n\nThank you for your email. We acknowledge that you will follow up after one month.\n\nWe look forward to hearing from you.\n\nBest regards,\nPlacement Team`;
    }
    
    if (hrContent.toLowerCase().includes('visit') || hrContent.toLowerCase().includes('college')) {
      return `Dear ${contact.name},\n\nThank you for informing us about your visit to our college.\n\nWe will make the necessary arrangements and look forward to your visit.\n\nBest regards,\nPlacement Team`;
    }
    
    if (hrContent.toLowerCase().includes('students') || hrContent.toLowerCase().includes('requirement')) {
      return `Dear ${contact.name},\n\nThank you for your email regarding student requirements.\n\nWe will prepare the requested information and get back to you shortly.\n\nBest regards,\nPlacement Team`;
    }
    
    return `Dear ${contact.name},\n\nThank you for your email.\n\nWe have received your message and will respond accordingly.\n\nBest regards,\nPlacement Team`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">AI Generated Response Draft</h3>
              <p className="text-sm text-amber-600 font-medium mt-1">
                🤖 Auto-generated - Please review before sending
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm text-blue-800">
              <strong>HR Email:</strong> {hrReply.content.substring(0, 100)}...
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
            <input
              type="text"
              value={draft.subject}
              onChange={(e) => setDraft({...draft, subject: e.target.value})}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft({...draft, content: e.target.value})}
              rows={8}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => onSendDraft(draft)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
            >
              Send Response
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutoDraftModal;