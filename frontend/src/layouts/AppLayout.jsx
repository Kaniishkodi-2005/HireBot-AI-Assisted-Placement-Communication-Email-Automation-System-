import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { useEffect, useState, useRef } from "react";

import { Bell } from "lucide-react";

import { getHrReplyNotifications, checkForNewHrReplies, fetchReceivedEmails, clearAllNotifications } from "../services/hrService";
import { playNotificationSound } from "../utils/soundUtility";

function AppLayout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const isUser = user?.role === "user";
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  // Track last seen time for sound: only play if new notif is newer than this session start (Date.now())
  // This ensures we NEVER play sounds for old messages on login/reload.
  const lastSeenTimeRef = useRef(Date.now());

  // Close notifications on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch notifications (replies)
  useEffect(() => {
    // Fetch for both user and admin, or just check if user exists.
    // Assuming HR features are available to both or based on access.
    if (user) {
      const fetchNotifications = async () => {
        try {
          // --- OPTIMIZATION START ---
          // 1. FAST LOAD: Get existing notifications from DB immediately so UI is not empty
          const loadData = async () => {
            try {
              const data = await getHrReplyNotifications();
              const rawNotifs = data.notifications || (Array.isArray(data) ? data : []);
              processAndSetNotifications(rawNotifs);
            } catch (e) { console.error("Fast load error", e); }
          };

          await loadData(); // Show what we have instantly

          // 2. BACKGROUND SYNC: Check for new stuff (this is slow, don't block UI)
          try {
            await fetchReceivedEmails();
            await checkForNewHrReplies();
            // 3. REFRESH: Get updated list after sync
            await loadData();
          } catch (e) { console.error("Background sync error", e); }

        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        }
      };

      // Helper to process raw data (dedup, sort, set state)
      const processAndSetNotifications = (rawNotifs) => {
        // STRICT Content-Based Deduplication
        // We ignore ID if it causes duplicates. We trust the content.
        const uniqueMap = new Map();
        rawNotifs.forEach(n => {
          // Create a key that absolutely defines uniqueness for the user
          const sender = n.contact?.name || "Unknown";
          const company = n.contact?.company || "Unknown";
          const time = n.timestamp || n.created_at || "Unknown";
          const msg = n.content || n.message || n.subject || "";

          // Persistent Filter REMOVED: Database is now source of truth for "is_read".

          const key = `${sender}|${company}|${time}|${msg.substring(0, 20)}`;

          if (!uniqueMap.has(key)) {
            // Enhance object with this key for sound tracking
            uniqueMap.set(key, { ...n, _dedupKey: key });
          }
        });
        const uniqueNotifs = Array.from(uniqueMap.values());

        // Sort by timestamp descending (Newest first)
        uniqueNotifs.sort((a, b) => {
          const tA = new Date(a.timestamp || a.created_at || 0).getTime();
          const tB = new Date(b.timestamp || b.created_at || 0).getTime();
          return tB - tA;
        });

        setNotifications(uniqueNotifs);

        // Sound Logic: Only play if the newest notification is newer than what we've seen THIS SESSION
        if (uniqueNotifs.length > 0) {
          const newest = uniqueNotifs[0];
          const newestTime = new Date(newest.timestamp || newest.created_at).getTime();

          // If newest is newer than our session reference...
          if (newestTime > lastSeenTimeRef.current) {
            playNotificationSound();
            lastSeenTimeRef.current = newestTime; // Update ref so we don't play again for this msg
          }
        }
      };

      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      setShowNotifications(false);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  // Redirect to login if no user
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Don't render if no user
  if (loading || !user) {
    return null;
  }

  // Determine if sidebar should be shown
  const showSidebar = ["/dashboard/admin", "/dashboard/hr", "/dashboard/students", "/dashboard/hr/edit", "/dashboard/students/edit"].includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-row bg-hb-bg dark:bg-slate-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      {/* Collapsible Sidebar */}
      {showSidebar && (
        <aside className="h-screen sticky top-0 left-0 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 shadow-xl z-50 flex flex-col w-16 shrink-0 font-sans z-[60]">
          {/* Logo Section */}
          <div className="h-16 flex items-center justify-center px-4 border-b border-gray-50 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center justify-center w-full">
              <img
                src="/assets/hirebot-logo.jpg"
                alt="HireBot"
                className="w-10 h-10 object-contain rounded-xl shadow-sm mix-blend-multiply dark:mix-blend-normal"
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-2 py-8 space-y-4 flex flex-col items-center">

            {/* Admin Dashboard Link */}
            {isAdmin && (
              <Link
                to="/dashboard/admin"
                className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group/link ${location.pathname.includes("/dashboard/admin")
                  ? "text-white shadow-lg shadow-indigo-500/30"
                  : "text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-[#5D5FEF]"
                  }`}
                style={location.pathname.includes("/dashboard/admin") ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="absolute left-12 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover/link:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl whitespace-nowrap z-50 px-2 py-1 z-50 rounded bg-slate-900 text-white" style={{ color: 'white', backgroundColor: '#111827' }}>
                  Admin Dashboard
                </span>
              </Link>
            )}

            {/* User & Admin Links */}
            {(isUser || isAdmin) && (
              <>
                <Link
                  to="/dashboard/hr"
                  className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group/link ${location.pathname.includes("/dashboard/hr")
                    ? "text-white shadow-lg shadow-indigo-500/30"
                    : "text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-[#5D5FEF]"
                    }`}
                  style={location.pathname.includes("/dashboard/hr") ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="absolute left-12 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover/link:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl whitespace-nowrap z-50 px-2 py-1 z-50 rounded bg-slate-900 text-white" style={{ color: 'white', backgroundColor: '#111827' }}>
                    HR Dashboard
                  </span>
                </Link>

                <Link
                  to="/dashboard/students"
                  className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 group/link ${location.pathname.includes("/dashboard/students")
                    ? "text-white shadow-lg shadow-indigo-500/30"
                    : "text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-[#5D5FEF]"
                    }`}
                  style={location.pathname.includes("/dashboard/students") ? { background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' } : {}}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="absolute left-12 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover/link:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl whitespace-nowrap z-50 px-2 py-1 z-50 rounded bg-slate-900 text-white" style={{ color: 'white', backgroundColor: '#111827' }}>
                    Student Dashboard
                  </span>
                </Link>
              </>
            )}
          </nav>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 flex items-center justify-between shadow-sm z-40 transition-colors duration-200">
          {/* Left: Branding */}
          {/* Left: Branding */}
          <div className="flex items-center gap-1">
            {!showSidebar && (
              <img
                src="/assets/hirebot-logo.jpg"
                alt="HireBot"
                className="w-10 h-10 object-contain rounded-xl shadow-sm mix-blend-multiply dark:mix-blend-normal"
              />
            )}
            <span className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">HireBot</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden z-[60] animate-fade-in origin-top-right">
                  <div className="p-3 border-b border-gray-50 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Notifications</h3>
                    <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">{notifications.length} New</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                        <p>No new notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50 dark:divide-slate-800">
                        {notifications.map((notif, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setShowNotifications(false);
                              if (notif.contact?.id) {
                                navigate("/dashboard/hr", { state: { openContactId: notif.contact.id } });
                              }
                            }}
                            className="p-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg shrink-0 mt-0.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{notif.contact?.name || "Unknown Sender"}</p>
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium">{notif.contact?.company || "Unknown Company"}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.content || notif.message || notif.subject || "New Reply Received"}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                  {/* Date format: DD/MM/YYYY */}
                                  {notif.timestamp
                                    ? new Date(notif.timestamp).toLocaleString("en-GB", {
                                      day: '2-digit', month: '2-digit', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit', hour12: true
                                    })
                                    : new Date().toLocaleString("en-GB", {
                                      day: '2-digit', month: '2-digit', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit', hour12: true
                                    })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="p-2 border-t border-gray-50 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-center">
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 w-full py-1"
                      >
                        Mark all as read
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="h-8 w-px bg-gray-200 dark:bg-slate-700"></div>

            {/* Right: User Profile */}
            <div className="relative group">
              <button className="flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-slate-700">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{user.full_name || user.name || user.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{user.role}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-slate-700 border border-purple-100 dark:border-slate-600 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-lg shadow-sm">
                  {(user.full_name || user.name || user.email)[0].toUpperCase()}
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50 translate-y-2 group-hover:translate-y-0">
                <div className="p-2">
                  <Link to="/settings" className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-slate-800 hover:text-[#9333ea] dark:hover:text-[#9333ea] transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                  <div className="h-px bg-gray-50 dark:bg-slate-800 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-6 bg-hb-bg dark:bg-slate-950 overflow-y-auto">
          <Outlet />
        </main>
      </div >
    </div >
  );
}

export default AppLayout;
