import { useState, useEffect } from "react";
import RichTextEditor from "./RichTextEditor";

function EmailConfirmationModal({ draft, contact, onClose, onSend, onBack }) {
  const [loading, setLoading] = useState(false);
  const [editedContent, setEditedContent] = useState(draft?.content || "");
  const [editedSubject, setEditedSubject] = useState(draft?.subject || "");
  const [editedTo, setEditedTo] = useState(contact?.email || draft?.to || draft?.recipient_email || "");
  const [editedFrom, setEditedFrom] = useState("bitplacement28@gmail.com");
  const [isConfidential, setIsConfidential] = useState(false);
  const [confidentialSettings, setConfidentialSettings] = useState({
    expiry_days: 7,
    disable_forwarding: true,
    disable_copying: true,
    disable_downloading: true,
    disable_printing: true,
    require_otp: true
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    // Scroll to top first to ensure modal is visible
    window.scrollTo(0, 0);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleSend = async () => {
    setLoading(true);
    try {
      await onSend({
        ...draft,
        subject: editedSubject,
        content: editedContent,
        to: editedTo,
        from: editedFrom,
        is_confidential: isConfidential,
        ...confidentialSettings
      });
    } catch (error) {
      console.error("Failed to send email:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!draft) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl relative transition-colors duration-200">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Review & Send Email</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">To: {contact?.email}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">To</label>
              <input
                type="email"
                value={editedTo}
                onChange={(e) => setEditedTo(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">From</label>
              <input
                type="email"
                value={editedFrom}
                onChange={(e) => setEditedFrom(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">Subject</label>
            <input
              type="text"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">Email Content</label>
            <RichTextEditor
              value={editedContent}
              onChange={setEditedContent}
              className="w-full"
              isConfidential={isConfidential}
              onToggleConfidential={setIsConfidential}
            />
          </div>

          {/* Confidential Mode Settings Panel */}
          {isConfidential && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-900/50 rounded-lg p-5 space-y-4 animate-fade-in text-purple-900 dark:text-purple-100 shadow-sm">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-600 rounded-lg text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Confidential Mode Configuration</h4>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider font-semibold">Maximum Privacy Enabled</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {/* Expiry Setting */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                    Content Expiration
                  </label>
                  <select
                    value={confidentialSettings.expiry_days}
                    onChange={(e) => setConfidentialSettings(prev => ({ ...prev, expiry_days: parseInt(e.target.value) }))}
                    className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-md px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 dark:text-white"
                  >
                    <option value={1}>Expires in 1 Day</option>
                    <option value={7}>Expires in 7 Days (Default)</option>
                    <option value={30}>Expires in 30 Days</option>
                    <option value={90}>Expires in 3 Months</option>
                  </select>
                </div>

                {/* OTP Requirement */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confidentialSettings.require_otp}
                      onChange={(e) => setConfidentialSettings(prev => ({ ...prev, require_otp: e.target.checked }))}
                      className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                    Require OTP (Verification)
                  </label>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 pl-5 leading-tight">Recipient must enter a code sent via backend to view content.</p>
                </div>

                {/* Restricted Actions */}
                <div className="col-span-2 space-y-3 pt-2">
                  <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest border-b border-purple-100 dark:border-purple-800 pb-1">Forbidden Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'disable_forwarding', label: 'No Forwarding', icon: 'M10 19l-7-7m0 0l7-7m-7 7h18' },
                      { key: 'disable_copying', label: 'No Copying', icon: 'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3' },
                      { key: 'disable_downloading', label: 'No Downloading', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
                      { key: 'disable_printing', label: 'No Printing', icon: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z' }
                    ].map(action => (
                      <label key={action.key} className="flex items-center gap-2 group cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confidentialSettings[action.key]}
                          onChange={(e) => setConfidentialSettings(prev => ({ ...prev, [action.key]: e.target.checked }))}
                          className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                          </svg>
                          <span className="text-xs font-semibold group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">{action.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-600">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Human Approval Required</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  HireBot assists with draft generation. Please review carefully before sending to {contact?.email}.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl">
          <div className="flex gap-3 justify-between">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all font-medium flex items-center gap-2"
            >
              ← Back to Templates
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={loading || !editedSubject.trim() || !editedContent.trim() || !editedTo.trim() || !editedFrom.trim()}
                className="px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}
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