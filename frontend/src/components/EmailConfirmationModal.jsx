import { useState } from "react";

function EmailConfirmationModal({ draft, contact, onClose, onSend, onBack }) {
  const [loading, setLoading] = useState(false);
  const [editedContent, setEditedContent] = useState(draft?.content || "");
  const [editedSubject, setEditedSubject] = useState(draft?.subject || "");
  const [editedTo, setEditedTo] = useState(contact?.email || draft?.to || draft?.recipient_email || "");
  const [editedFrom, setEditedFrom] = useState("bitplacement28@gmail.com");

  const handleSend = async () => {
    setLoading(true);
    try {
      await onSend({
        ...draft,
        subject: editedSubject,
        content: editedContent,
        to: editedTo,
        from: editedFrom
      });
    } catch (error) {
      console.error("Failed to send email:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!draft) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Review & Send Email</h3>
              <p className="text-sm text-slate-500 mt-1">To: {contact?.email}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">To</label>
              <input
                type="email"
                value={editedTo}
                onChange={(e) => setEditedTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">From</label>
              <input
                type="email"
                value={editedFrom}
                onChange={(e) => setEditedFrom(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
            <input
              type="text"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email Content</label>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={12}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-600">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Human Approval Required</p>
                <p className="text-xs text-amber-700 mt-1">
                  HireBot assists with draft generation. Please review carefully before sending to {contact?.email}.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div className="flex gap-3 justify-between">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-medium flex items-center gap-2"
            >
              ← Back to Templates
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={loading || !editedSubject.trim() || !editedContent.trim() || !editedTo.trim() || !editedFrom.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
              >
                {loading && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>}
                Send Email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailConfirmationModal;