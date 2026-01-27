import { useState, useEffect, useRef } from 'react';

function RichTextEditor({ value, onChange, placeholder, className }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // State for content and content history
  const [html, setHtml] = useState(value || '');
  const [history, setHistory] = useState([value || '']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [showFormatting, setShowFormatting] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [isConfidential, setIsConfidential] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Synchronize internal state if external value changes significantly
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      // Only update if truly different to avoid losing cursor position or history on minor updates
      // Note: This check helps but native undo is still fragile with React updates.
      if (value !== html) {
        setHtml(value);
        editorRef.current.innerHTML = value;
        // We don't push to history here to avoid loops, history is user-action driven
      }
    }
  }, [value]);

  // Custom History Management
  const addToHistory = (newHtml) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newHtml);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevHtml = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setHtml(prevHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = prevHtml;
        if (onChange) onChange(prevHtml);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextHtml = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setHtml(nextHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = nextHtml;
        if (onChange) onChange(nextHtml);
      }
    }
  };

  const execCommand = (command, value = null) => {
    // Intercept Undo/Redo to use our custom history
    if (command === 'undo') {
      handleUndo();
      return;
    }
    if (command === 'redo') {
      handleRedo();
      return;
    }

    document.execCommand(command, false, value);
    if (editorRef.current) {
      handleInput(); // Capture state change
      editorRef.current.focus();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      const newHtml = editorRef.current.innerHTML;

      // Debounce history push or just push on major changes? 
      // For simplicity, we push if different from current head
      if (newHtml !== history[historyIndex]) {
        addToHistory(newHtml);
      }

      setHtml(newHtml);
      if (onChange) {
        onChange(newHtml);
      }
    }
  };

  const ToolbarButton = ({ command, value, children, title }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent focus loss on click
        execCommand(command, value);
      }}
      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-[4px] transition-colors min-w-[28px] h-[28px] flex items-center justify-center cursor-pointer"
      title={title}
    >
      {/* Ensure children don't block events */}
      <span className="pointer-events-none flex items-center justify-center">
        {children}
      </span>
    </button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-5 bg-gray-200 mx-1 self-center"></div>
  );

  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (!url) return;

    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      execCommand('createLink', url);
    } else {
      // If no text selected, insert the URL itself as a link
      execCommand('insertHTML', `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    }
  };

  // --- Image Upload Logic ---
  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        execCommand('insertImage', e.target.result);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  // --- Attachment Logic ---
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // --- Emoji Logic ---
  const COMMON_EMOJIS = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠'];

  const insertEmoji = (emoji) => {
    execCommand('insertText', emoji);
    setShowEmojiPicker(false);
  };

  // --- Signature Logic ---
  const insertSignature = () => {
    // Basic signature template
    const signatureHTML = `<br><br><div>--<br><strong>Best Regards,</strong><br>Placement Team<br>HireBot AI System</div>`;
    execCommand('insertHTML', signatureHTML);
  };

  // --- Drive (Mock) ---
  const handleDriveClick = () => {
    alert("Google Drive integration would open here.");
  };

  // --- Paste Handling (Auto-Link) ---
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return; // Allow default if no text

    const trimmedText = text.trim();
    // Regex to match URLs (starting with http/s or www)
    const urlRegex = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;

    if (urlRegex.test(trimmedText)) {
      e.preventDefault();

      const selection = window.getSelection();
      const href = trimmedText.match(/^www\./i) ? `http://${trimmedText}` : trimmedText;

      try {
        if (!selection.isCollapsed) {
          // Linkify selected text
          execCommand('createLink', href);
        } else {
          // Insert URL as link
          execCommand('insertHTML', `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${trimmedText}</a>&nbsp;`);
        }
      } catch (err) {
        console.error("Paste error:", err);
        // Fallback: Just insert text if command fails
        execCommand('insertText', text);
      }
    }
    // If not a URL, let default paste happen (do nothing here)
  };

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col ${className}`}>

      {/* Top Formatting Toolbar (Toggled by Aa) */}
      {showFormatting && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-200 bg-[#f9fbfd]">
          {/* Undo / Redo */}
          <ToolbarButton command="undo" title="Undo (Ctrl+Z)">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
          </ToolbarButton>
          <ToolbarButton command="redo" title="Redo (Ctrl+Y)">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 3.7" /></svg>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Font Family (Simulated) */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-[4px]">
              Sans Serif <svg className="w-3 h-3 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
            </button>
            <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded shadow-lg hidden group-hover:block z-10 py-1">
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('fontName', 'Sans-Serif'); }} className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm font-sans">Sans Serif</button>
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('fontName', 'Serif'); }} className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm font-serif">Serif</button>
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('fontName', 'Monospace'); }} className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm font-mono">Fixed Width</button>
            </div>
          </div>


          {/* Note: Font Size "TT" icon removed as per user request */}

          <ToolbarDivider />

          {/* Basic Formatting */}
          <ToolbarButton command="bold" title="Bold (Ctrl+B)">
            <span className="font-bold font-serif text-base">B</span>
          </ToolbarButton>
          <ToolbarButton command="italic" title="Italic (Ctrl+I)">
            <span className="italic font-serif text-base">I</span>
          </ToolbarButton>
          <ToolbarButton command="underline" title="Underline (Ctrl+U)">
            <span className="underline font-serif text-base">U</span>
          </ToolbarButton>
          <ToolbarButton command="foreColor" value="#1a73e8" title="Text Color (Blue)">
            <div className="flex flex-col items-center justify-center">
              <span className="font-bold text-sm leading-none">A</span>
              <span className="w-4 h-1 bg-black mt-0.5"></span>
            </div>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton command="justifyLeft" title="Align Left">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
          </ToolbarButton>
          <ToolbarButton command="justifyCenter" title="Align Center">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="6" y1="18" x2="18" y2="18" /></svg>
          </ToolbarButton>
          <ToolbarButton command="justifyRight" title="Align Right">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton command="insertUnorderedList" title="Bullet List">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="7" r="2" />
              <rect x="10" y="6" width="10" height="2" rx="1" />
              <circle cx="5" cy="12" r="2" />
              <rect x="10" y="11" width="10" height="2" rx="1" />
              <circle cx="5" cy="17" r="2" />
              <rect x="10" y="16" width="10" height="2" rx="1" />
            </svg>
          </ToolbarButton>
          <ToolbarButton command="insertOrderedList" title="Numbered List">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6h2v-2h-1v-1h3v3h-2v9h4v2h-6v-2h2v-9zM10 6h10v2h-10v-2zM10 11h10v2h-10v-2zM10 16h10v2h-10v-2z" />
              <text x="3" y="17" fontSize="14" fontWeight="bold" fontFamily="sans-serif">1</text>
              <line x1="10" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="2" />
              <line x1="10" y1="13" x2="20" y2="13" stroke="currentColor" strokeWidth="2" />
              <line x1="10" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Strikethrough Only (Quote Removed) */}
          <ToolbarButton command="strikeThrough" title="Strikethrough">
            <span className="line-through font-serif text-base">S</span>
          </ToolbarButton>

        </div>
      )}

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        className="flex-1 p-4 outline-none text-sm text-gray-800 leading-relaxed overflow-y-auto"
        onInput={handleInput}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: value }}
        style={{ minHeight: '300px' }}
      >
      </div>

      {/* Attachments Area */}
      {attachments.length > 0 && (
        <div className="p-2 border-t border-gray-100 bg-white flex flex-col gap-1">
          <div className="text-xs font-semibold text-gray-500 mb-1">Attachments</div>
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center gap-2 group p-1 hover:bg-gray-50 rounded">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    const url = URL.createObjectURL(file);
                    window.open(url, '_blank');
                  }}
                  className="text-sm font-medium text-blue-700 hover:underline cursor-pointer text-left"
                >
                  {file.name}
                </button>
                <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
              <button
                onClick={() => removeAttachment(index)}
                className="ml-auto text-gray-400 hover:text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove attachment"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="relative flex items-center gap-2 p-2 px-3 border-t border-gray-100 bg-gray-50">
        {/* Aa - Toggle Formatting */}
        <button
          onClick={() => setShowFormatting(!showFormatting)}
          className={`p-2 rounded hover:bg-gray-200 text-gray-700 font-medium flex items-center justify-center min-w-[32px] ${showFormatting ? 'bg-gray-200' : ''}`}
          title="Formatting options"
        >
          <span className="text-lg underline font-serif">A</span>
          <span className="text-sm border-b-2 border-transparent">a</span>
        </button>

        {/* Attach Files */}
        <button
          onClick={handleAttachClick}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded-full"
          title="Attach files"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        </button>
        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />

        {/* Link */}
        <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full" title="Insert link" onMouseDown={(e) => { e.preventDefault(); handleLink(); }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        </button>

        {/* Emoji */}
        <div className="relative">
          <button
            className="p-2 text-gray-600 hover:bg-gray-200 rounded-full"
            title="Insert emoji"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-gray-200 rounded-lg shadow-xl grid grid-cols-8 gap-1 w-64 z-50">
              {COMMON_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => insertEmoji(emoji)} className="text-xl hover:bg-gray-100 p-1 rounded">
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drive */}
        <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full" title="Insert files using Drive" onMouseDown={(e) => { e.preventDefault(); handleDriveClick(); }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 19.77h20L12 2zm0 3.3L18.7 18H5.3L12 5.3z" /></svg>
        </button>

        {/* Photo */}
        <button
          className="p-2 text-gray-600 hover:bg-gray-200 rounded-full"
          title="Insert photo"
          onMouseDown={(e) => { e.preventDefault(); handleImageClick(); }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
        </button>
        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />

        {/* Confidential */}
        <button
          className={`p-2 rounded-full transition-colors ${isConfidential ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
          title="Toggle confidential mode"
          onMouseDown={(e) => { e.preventDefault(); setIsConfidential(!isConfidential); }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="12" cy="16" r="1" /></svg>
        </button>

        {/* Signature */}
        <button
          className="p-2 text-gray-600 hover:bg-gray-200 rounded-full"
          title="Insert signature"
          onMouseDown={(e) => { e.preventDefault(); insertSignature(); }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
        </button>

        <div className="flex-1"></div>
      </div>
    </div>
  );
}

export default RichTextEditor;
