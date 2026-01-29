import { useState, useEffect, useRef } from 'react';
import useDrivePicker from 'react-google-drive-picker';

// Update function signature to accept new props
function RichTextEditor({ value, onChange, placeholder, className, isConfidential: propIsConfidential, onToggleConfidential }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const colorInputRef = useRef(null);
  const savedRange = useRef(null);

  // State for content and content history
  const [initialContent] = useState(value || '');
  const [html, setHtml] = useState(value || '');
  const [history, setHistory] = useState([value || '']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [showFormatting, setShowFormatting] = useState(true);
  const [attachments, setAttachments] = useState([]);
  // Internal state fallback if not controlled
  const [internalIsConfidential, setInternalIsConfidential] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [notification, setNotification] = useState(null);

  // Determine effective state
  const isConfidential = propIsConfidential !== undefined ? propIsConfidential : internalIsConfidential;
  const toggleConfidential = () => {
    const newState = !isConfidential;
    if (onToggleConfidential) {
      onToggleConfidential(newState);
    } else {
      setInternalIsConfidential(newState);
    }

    // Show notification with type
    if (newState) {
      setNotification({ text: "Confidential Mode Enabled", type: "success" });
    } else {
      setNotification({ text: "Confidential Mode Disabled", type: "neutral" });
    }
    setTimeout(() => setNotification(null), 3000);
  };





  // Synchronize internal state if external value changes significantly
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      // Only update if truly different to avoid losing cursor position or history on minor updates
      // Note: This check helps but native undo is still fragile with React updates.
      if (value !== html) {
        // Only update innerHTML if the editor is NOT currently focused
        // This prevents cursor jumping when the user is actively typing
        if (document.activeElement !== editorRef.current) {
          setHtml(value);
          editorRef.current.innerHTML = value;
          // We don't push to history here to avoid loops, history is user-action driven
        }
      }
    }
  }, [value, html]);

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

  // --- Active State Logic ---
  const [activeFormats, setActiveFormats] = useState({});

  const checkFormats = () => {
    if (!editorRef.current) return;

    // List of commands to check
    const commands = [
      'bold', 'italic', 'underline', 'strikeThrough',
      'justifyLeft', 'justifyCenter', 'justifyRight',
      'insertUnorderedList', 'insertOrderedList'
    ];

    const newFormats = {};
    commands.forEach(cmd => {
      newFormats[cmd] = document.queryCommandState(cmd);
    });
    setActiveFormats(newFormats);
  };

  // Wrap existing input handler
  const handleInputWithCheck = () => {
    handleInput();
    checkFormats();
  };

  const ToolbarButton = ({ command, value, children, title, isActive }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent focus loss on click
        execCommand(command, value);
        setTimeout(checkFormats, 10); // Check after command execution
      }}
      className={`p-1.5 rounded-[4px] transition-colors min-w-[28px] h-[28px] flex items-center justify-center cursor-pointer ${isActive
        ? 'bg-gray-200 text-black shadow-inner'
        : 'text-gray-600 hover:bg-gray-100'
        }`}
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
    // Save current selection/range BEFORE prompt
    const selection = window.getSelection();
    let range = null;
    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0).cloneRange(); // Clone the range
    }

    const url = prompt('Enter URL:');
    if (!url) return;

    // Refocus editor first
    if (editorRef.current) {
      editorRef.current.focus();
    }

    // Restore selection after prompt
    if (range) {
      const newSelection = window.getSelection();
      newSelection.removeAllRanges();
      newSelection.addRange(range);
    }

    if (selection.toString().length > 0) {
      execCommand('createLink', url);
    } else {
      // If no text selected, insert the URL itself as a link with tooltip
      const linkHtml = `<a href="${url}" title="Ctrl+Click to open: ${url}" target="_blank" rel="noopener noreferrer">${url}</a>&nbsp;`;
      execCommand('insertHTML', linkHtml);
    }
  };

  // --- Image URL Logic ---
  const handleImageClick = () => {
    const imageUrl = prompt('Enter image URL:');
    if (!imageUrl) return;

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch (e) {
      alert('⚠️ Invalid URL format!\n\nPlease enter a valid image URL (e.g., https://example.com/image.jpg)');
      return;
    }

    // Insert image using URL
    const imgHtml = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; height: auto; border-radius: 4px;" /><br/>`;
    execCommand('insertHTML', imgHtml);
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
    // Updated signature template per user request
    const signatureHTML = `<br><br><div>Best regards,<br>Placement Team<br>Bannari Amman Institute of Technology</div>`;
    execCommand('insertHTML', signatureHTML);
  };

  // Add import at the top (requires another tool call, will handle next)
  // For now, implementing the hook usage in the component body

  // --- Drive (External Link) ---
  const [openPicker] = useDrivePicker();

  const handleDriveClick = () => {
    // Save current selection range
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // Ensure range is within editor
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRange.current = range;
      }
    }

    openPicker({
      clientId: "54602439728-fg5ei9f8n3597jg7juc2vhhh7lnadv1n.apps.googleusercontent.com",
      developerKey: "AIzaSyAIJOCDO-l9Fx1arCV1Tt95AzT0hwUdFW0",
      viewId: "DOCS", // View all files
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      callbackFunction: (data) => {
        if (data.action === 'picked') {
          // Use timeout to allow window to regain focus
          setTimeout(() => {
            // Restore selection or focus mostly for UX, but insertion will be at end
            if (editorRef.current) {
              editorRef.current.focus({ preventScroll: true });
            }

            data.docs.forEach(doc => {
              // Create a nice looking drive attachment card
              const driveHtml = `
                <br/><div contenteditable="false" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; margin: 4px 0; user-select: none;">
                  <a href="${doc.url}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: #374151;">
                    <img src="${doc.iconUrl || 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png'}" alt="Drive" style="width: 20px; height: 20px;" />
                    <span style="font-weight: 500; font-size: 14px; font-family: sans-serif;">${doc.name}</span>
                  </a>
                  <a href="${doc.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-size: 18px; margin-left: 4px; display: flex; align-items: center;" title="Open Link">&#8599;</a>
                </div><br/>
              `;

              // Always append to the end as requested
              if (editorRef.current) {
                // Check if we need a newline prefix
                const content = editorRef.current.innerHTML;
                if (!content.trim().endsWith('<br>') && !content.trim().endsWith('</div>')) {
                  editorRef.current.innerHTML += '<br>';
                }
                editorRef.current.innerHTML += driveHtml;

                // Trigger change
                if (onChange) onChange(editorRef.current.innerHTML);

                // Scroll to bottom
                editorRef.current.scrollTop = editorRef.current.scrollHeight;
              }
            });

            savedRange.current = null;
          }, 100);
        }
      }
    });
  };

  // --- Paste Handling (Auto-Link) ---
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return; // Allow default if no text

    const trimmedText = text.trim();

    // Improved Regex to match URLs (starting with http/s or www)
    // Matches http:// or https:// followed by non-spaces, OR www. followed by non-spaces
    const urlRegex = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i;

    if (urlRegex.test(trimmedText)) {
      e.preventDefault();

      const selection = window.getSelection();
      let href = trimmedText;
      if (!/^https?:\/\//i.test(trimmedText)) {
        href = `http://${trimmedText}`;
      }

      try {
        if (!selection.isCollapsed) {
          // Linkify selected text
          execCommand('createLink', href);
        } else {
          // Insert URL as link
          // We manually create the HTML to ensure consistent styling
          const linkHtml = `<a href="${href}" title="Ctrl+Click to open: ${href}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${trimmedText}</a>&nbsp;`;
          execCommand('insertHTML', linkHtml);
        }
      } catch (err) {
        console.error("Paste error:", err);
        // Fallback: Just insert text if command fails
        execCommand('insertText', text);
      }
    }
    // If not a URL, let default paste happen (do nothing here)
  };


  // --- Color Picker Logic ---
  const [showColorPicker, setShowColorPicker] = useState(false);

  const COLOR_PALETTE = [
    '#000000', '#434343', '#666666', '#999999', '#CCCCCC', '#EFEFEF', '#F3F3F3', '#FFFFFF',
    '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF',
    '#9900FF', '#FF00FF', '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3',
    '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC', '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599',
    '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD', '#CC4125', '#E06666',
    '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0'
  ];

  // --- Key Down Logic (Fix for List Backspace) ---
  const handleKeyDown = (e) => {
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const element = node.nodeType === 3 ? node.parentElement : node;
        const li = element.closest('li');

        if (li) {
          // Check if cursor is at the start of the list item
          const tempRange = range.cloneRange();
          tempRange.selectNodeContents(li);
          tempRange.setEnd(range.startContainer, range.startOffset);

          // If the content from start to cursor is empty, we are at the beginning
          if (tempRange.toString().length === 0) {
            e.preventDefault();
            execCommand('outdent');
          }
        }
      }
    }
  };

  const handleEditorClick = (e) => {
    if (e.target.tagName === 'A' || e.target.closest('a')) {
      // Allow navigation only if Ctrl or Meta (Cmd) key is pressed
      if (e.ctrlKey || e.metaKey) {
        return;
      }
      // Otherwise prevent default navigation to allow editing
      e.preventDefault();
    }
  };

  return (
    <div className={`relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col ${className}`}>

      {/* Top Formatting Toolbar (Toggled by Aa) */}

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
          <ToolbarButton command="bold" title="Bold (Ctrl+B)" isActive={activeFormats['bold']}>
            <span className="font-bold font-serif text-base">B</span>
          </ToolbarButton>
          <ToolbarButton command="italic" title="Italic (Ctrl+I)" isActive={activeFormats['italic']}>
            <span className="italic font-serif text-base">I</span>
          </ToolbarButton>
          <ToolbarButton command="underline" title="Underline (Ctrl+U)" isActive={activeFormats['underline']}>
            <span className="underline font-serif text-base">U</span>
          </ToolbarButton>

          {/* Custom Color Picker Button */}
          <div className="relative">
            <button
              type="button"
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-[4px] transition-colors min-w-[28px] h-[28px] flex items-center justify-center cursor-pointer"
              title="Text Color"
              onClick={() => setShowColorPicker(!showColorPicker)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center justify-center w-full h-full">
                <span className="font-bold text-sm leading-none">A</span>
                <span className="w-4 h-1 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 mt-0.5"></span>
              </div>
            </button>

            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 shadow-xl grid grid-cols-8 gap-1 z-50 w-64 rounded-lg">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      execCommand('foreColor', c);
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded-full hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 border border-gray-100"
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Strikethrough */}
          <ToolbarButton command="strikeThrough" title="Strikethrough" isActive={activeFormats['strikeThrough']}>
            <span className="line-through font-serif text-base">S</span>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton command="justifyLeft" title="Align Left" isActive={activeFormats['justifyLeft']}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
          </ToolbarButton>
          <ToolbarButton command="justifyCenter" title="Align Center" isActive={activeFormats['justifyCenter']}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="6" y1="18" x2="18" y2="18" /></svg>
          </ToolbarButton>
          <ToolbarButton command="justifyRight" title="Align Right" isActive={activeFormats['justifyRight']}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton command="insertUnorderedList" title="Bullet List" isActive={activeFormats['insertUnorderedList']}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="7" r="2" />
              <rect x="10" y="6" width="10" height="2" rx="1" />
              <circle cx="5" cy="12" r="2" />
              <rect x="10" y="11" width="10" height="2" rx="1" />
              <circle cx="5" cy="17" r="2" />
              <rect x="10" y="16" width="10" height="2" rx="1" />
            </svg>
          </ToolbarButton>
          <ToolbarButton command="insertOrderedList" title="Numbered List" isActive={activeFormats['insertOrderedList']}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6h2v-2h-1v-1h3v3h-2v9h4v2h-6v-2h2v-9zM10 6h10v2h-10v-2zM10 11h10v2h-10v-2zM10 16h10v2h-10v-2z" />
              <text x="3" y="17" fontSize="14" fontWeight="bold" fontFamily="sans-serif">1</text>
              <line x1="10" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="2" />
              <line x1="10" y1="13" x2="20" y2="13" stroke="currentColor" strokeWidth="2" />
              <line x1="10" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Strikethrough Moved */}

        </div>
      )}

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        className="flex-1 p-4 outline-none text-sm text-gray-800 leading-relaxed overflow-y-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline"
        onInput={handleInputWithCheck}
        onKeyDown={(e) => {
          handleKeyDown(e);
          setTimeout(checkFormats, 10);
        }}
        onKeyUp={checkFormats}
        onMouseUp={checkFormats}
        onClick={handleEditorClick}

        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: initialContent }}
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

        {/* Notification Toast (Bottom Center - Professional Blue) */}
        {notification && (
          <div
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-2 rounded-lg shadow-xl z-[100] flex items-center gap-3 transition-all duration-300 ease-out border bg-blue-600 text-white border-blue-500 animate-fade-in-up"
          >
            {notification.type === 'success' ? (
              <svg className="w-5 h-5 text-blue-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><path d="M12 16v.01" /></svg>
            ) : (
              <svg className="w-5 h-5 text-blue-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
            )}
            <span className="font-medium text-sm tracking-wide">{notification.text}</span>
          </div>
        )}

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

        {/* Confidential */}
        <button
          className={`p-2 rounded-full transition-colors ${isConfidential ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
          title="Toggle confidential mode"
          onMouseDown={(e) => { e.preventDefault(); toggleConfidential(); }}
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
