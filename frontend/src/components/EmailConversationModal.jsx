import { useState, useEffect, useRef } from "react";
import { parseHrReply, sendEmail } from "../services/hrService";

function EmailConversationModal({ contact, onClose, onRefresh }) {
  const [conversations, setConversations] = useState([]);
  const conversationEndRef = useRef(null);
  const didInitialScroll = useRef(false);
  const [latestHrReply, setLatestHrReply] = useState(null);

  useEffect(() => {
    console.log('=== EmailConversationModal useEffect ===');
    console.log('Contact data received:', contact);

    if (contact?.conversation && Array.isArray(contact.conversation)) {
      console.log('Processing', contact.conversation.length, 'conversation items');
      console.log('Raw conversation data:', contact.conversation.slice(0, 5)); // Show first 5 items

      const mappedConversations = contact.conversation.map((conv, index) => {
        let timestamp = new Date();
        if (conv.timestamp) {
          timestamp = typeof conv.timestamp === 'number' ? new Date(conv.timestamp) : new Date(conv.timestamp);
        } else if (conv.sent_at) {
          timestamp = typeof conv.sent_at === 'number' ? new Date(conv.sent_at) : new Date(conv.sent_at);
        }

        return {
          id: conv.id || `${Date.now()}-${Math.random()}`,
          message: conv.content || conv.message || '',
          type: conv.direction || 'sent',
          timestamp: timestamp,
          subject: conv.subject || '',
          direction: conv.direction
        };
      });

      console.log('Mapped conversations:', mappedConversations.slice(0, 5));
      console.log('Direction breakdown:', {
        sent: mappedConversations.filter(c => c.direction === 'sent').length,
        received: mappedConversations.filter(c => c.direction === 'received').length
      });

      // Remove duplicates based on content and timestamp only
      const uniqueConversations = mappedConversations.filter((conv, index, self) => {
        return index === self.findIndex(c => {
          const contentMatch = c.message.trim() === conv.message.trim();
          // Match by seconds only (ignore milliseconds difference)
          const timestampMatch = Math.floor(c.timestamp.getTime() / 1000) === Math.floor(conv.timestamp.getTime() / 1000);
          const directionMatch = c.direction === conv.direction;
          const subjectMatch = (c.subject || "").trim() === (conv.subject || "").trim();
          return contentMatch && timestampMatch && directionMatch && subjectMatch;
        });
      });

      console.log('After deduplication:', {
        total: uniqueConversations.length,
        sent: uniqueConversations.filter(c => c.direction === 'sent').length,
        received: uniqueConversations.filter(c => c.direction === 'received').length
      });

      uniqueConversations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setConversations(uniqueConversations);
    } else {
      console.log('No conversation data or not an array');
      setConversations([]);
    }
  }, [contact]);

  useEffect(() => {
    if (conversations.length > 0 && !didInitialScroll.current) {
      // Instant snap to bottom ONLY on the first load
      conversationEndRef.current?.scrollIntoView({ behavior: 'auto' });
      didInitialScroll.current = true;
    }
  }, [conversations]);

  // Robust Sort
  const sortedConversations = [...conversations].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tA - tB;
  });

  const formatTime = (date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date) => {
    if (!date || isNaN(date.getTime())) {
      return 'Today';
    }
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSendDraft = async (draft) => {
    try {
      await sendEmail(contact.id, draft);
      setShowAutoDraft(false);
      // Refresh conversation
      window.location.reload();
    } catch (error) {
      console.error('Failed to send draft:', error);
    }
  };

  const [otpVerified, setOtpVerified] = useState({}); // { id: content }
  const [otpInput, setOtpInput] = useState("");
  const [verifyingId, setVerifyingId] = useState(null);
  const [otpError, setOtpError] = useState("");

  const handleVerifyOtp = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/hr/conversation/verify-otp/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpInput })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Verification failed");

      setOtpVerified(prev => ({ ...prev, [id]: data.content }));
      setVerifyingId(null);
      setOtpInput("");
      setOtpError("");
    } catch (err) {
      setOtpError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl">
        {/* Professional Header */}
        <div className="px-6 py-5 rounded-t-xl" style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md">
                <span className="text-2xl">🏢</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{contact?.company}</h3>
                <p className="text-blue-100 text-sm">{contact?.name} • {contact?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 no-print">
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; }
            }
            .restricted-content {
              user-select: none !important;
              -webkit-user-select: none !important;
              -moz-user-select: none !important;
              -ms-user-select: none !important;
            }
          `}</style>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium">No conversation history</p>
              <p className="text-sm mt-1">Conversations will appear here after emails are exchanged</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Statistics info */}
              {conversations.length > 0 && (
                <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 flex items-center justify-between">
                  <span>
                    {conversations.length} {conversations.length === 1 ? 'message' : 'messages'}
                    {' '}({conversations.filter(c => c.direction === 'sent').length} sent, {conversations.filter(c => c.direction === 'received').length} received)
                  </span>
                </div>
              )}

              {sortedConversations.map((conv, idx) => {
                const showDate = idx === 0 ||
                  formatDate(conv.timestamp) !== formatDate(sortedConversations[idx - 1].timestamp);

                const isSent = conv.direction === 'sent';

                // Get original item from contact.conversation to access confidential flags
                const rawConv = contact.conversation.find(c => c.id === conv.id);
                const isConfidential = rawConv?.is_confidential;
                const isExpired = rawConv?.is_expired;
                const requireOtp = rawConv?.require_otp && !otpVerified[conv.id];
                const displayContent = otpVerified[conv.id] || conv.message || conv.content;

                return (
                  <div key={conv.id || idx} className="space-y-2">
                    {showDate && (
                      <div className="flex items-center justify-center my-6">
                        <div className="bg-gray-200 text-gray-600 text-xs font-medium px-4 py-1.5 rounded-full">
                          {formatDate(conv.timestamp)}
                        </div>
                      </div>
                    )}

                    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[75%] ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isSent
                          ? 'bg-purple-600'
                          : 'bg-gray-300 text-gray-700'
                          }`}>
                          {isSent ? (
                            <img
                              src="/avatar.png"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerText = 'P'; }}
                            />
                          ) : (
                            <img
                              src="/hr_avatar.png"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerText = 'H'; }}
                            />
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div className={`rounded-2xl px-4 py-3 shadow-sm ${rawConv?.disable_printing ? 'no-print' : ''} ${isSent
                          ? 'bg-purple-100 text-purple-900 border border-purple-200 rounded-br-md'
                          : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                          }`}>

                          {/* Confidential Header */}
                          {isConfidential && (
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-100">
                              <span className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md bg-red-600 text-white shadow-sm">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Confidential
                              </span>
                              {isExpired && (
                                <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-1 rounded-md uppercase tracking-tight">Expired Content</span>
                              )}
                              {!isExpired && rawConv?.expires_at && (
                                <span className="text-[10px] text-gray-500 font-medium">Expires: {new Date(rawConv.expires_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          )}

                          {/* Subject */}
                          {conv.subject && (
                            <div className={`text-sm font-bold mb-2 ${isSent ? 'text-purple-700' : 'text-gray-700'}`}>
                              {conv.subject}
                            </div>
                          )}

                          {/* Message Content */}
                          {requireOtp && !isExpired ? (
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col items-center gap-3 w-full min-w-[300px]">
                              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                              </div>
                              <p className="text-xs font-semibold text-gray-600 text-center">Identity Verification Required</p>

                              {verifyingId === conv.id ? (
                                <div className="space-y-3 w-full">
                                  <input
                                    type="text"
                                    placeholder="Enter 6-digit OTP"
                                    maxLength={6}
                                    value={otpInput}
                                    onChange={(e) => setOtpInput(e.target.value)}
                                    className="w-full text-center tracking-[0.5em] text-lg font-bold border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  {otpError && <p className="text-[10px] text-red-600 text-center">{otpError}</p>}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleVerifyOtp(conv.id)}
                                      className="flex-1 bg-blue-600 text-white rounded-md py-2 text-xs font-bold hover:bg-blue-700 transition-colors"
                                    >
                                      Verify
                                    </button>
                                    <button
                                      onClick={() => { setVerifyingId(null); setOtpInput(""); setOtpError(""); }}
                                      className="px-4 border rounded-md text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setVerifyingId(conv.id)}
                                  className="w-full bg-blue-600 text-white rounded-md py-2 text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                  Unlock Message
                                </button>
                              )}
                            </div>
                          ) : (
                            <div
                              className={`text-sm leading-relaxed prose prose-sm max-w-none email-content ${rawConv?.disable_copying ? 'restricted-content' : ''}`}
                              dangerouslySetInnerHTML={{ __html: displayContent || 'No content available' }}
                              onContextMenu={rawConv?.disable_copying ? (e) => e.preventDefault() : undefined}
                              style={{
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word'
                              }}
                            />
                          )}

                          <style dangerouslySetInnerHTML={{
                            __html: `
                            .email-content img {
                              max-width: 100%;
                              height: auto;
                              border-radius: 8px;
                              margin: 8px 0;
                            }
                          `}} />

                          {/* Timestamp */}
                          <div className={`text-xs mt-3 pt-2 border-t flex items-center justify-between ${isSent ? 'text-purple-600 border-purple-200' : 'text-gray-500 border-gray-100'
                            }`}>
                            <span>{formatTime(conv.timestamp)}</span>
                            {isSent && <span className="flex items-center gap-1 opacity-70"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Delivered</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={conversationEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailConversationModal;