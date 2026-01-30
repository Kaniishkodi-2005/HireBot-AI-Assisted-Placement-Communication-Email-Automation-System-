import { useEffect, useState } from 'react';
import { playNotificationSound } from '../utils/soundUtility';

// Use localStorage to track played sounds permanently (so they don't replay on reload)
const HrReplyNotification = ({ notifications, onDismiss }) => {
  // Use simple session-based tracking to guarantee one sound per ID per load
  // Load dismissed IDs from localStorage with error handling
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissedHrNotifications');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch (e) {
      console.warn('Error parsing dismissed notifications:', e);
      return new Set();
    }
  });

  // Track played sounds persistently so they ONLY play once ever
  const [playedSounds, setPlayedSounds] = useState(() => {
    try {
      const saved = localStorage.getItem('playedHrNotificationSounds');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch (e) {
      console.warn('Error parsing played sounds:', e);
      return new Set();
    }
  });

  const [audioReady, setAudioReady] = useState(false);

  // Resume UI feedback on any interaction AND play a silent sound to unlocking autoplay
  useEffect(() => {
    const unlockAudio = () => {
      if (!audioReady) {
        setAudioReady(true);
        // Play silent interaction to key the browser that audio is allowed
        const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        silentAudio.play().catch(() => { });
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [audioReady]);

  // Play sound for NEW notifications
  useEffect(() => {
    if (!notifications || !Array.isArray(notifications)) return;

    let hasNewSound = false;
    const nextPlayed = new Set(playedSounds);

    console.log('[DEBUG-AUDIO] Checking notifications:', notifications.length);
    console.log('[DEBUG-AUDIO] Already played:', [...playedSounds]);

    notifications.forEach(notification => {
      // Safety check for notification object
      if (!notification || !notification.id) return;

      // If we haven't played sound for this ID *ever*, play it!
      if (!playedSounds.has(notification.id)) {
        console.log('[DEBUG-AUDIO] New notification found, playing sound:', notification.id);
        playNotificationSound(); // Plays custom .mp3
        nextPlayed.add(notification.id);
        hasNewSound = true;
      } else {
        console.log('[DEBUG-AUDIO] Skipping sound for:', notification.id);
      }
    });

    if (hasNewSound) {
      setPlayedSounds(nextPlayed);
      localStorage.setItem('playedHrNotificationSounds', JSON.stringify([...nextPlayed]));
    }
  }, [notifications]);


  const handleDismiss = (id) => {
    onDismiss && onDismiss(id);
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissedHrNotifications', JSON.stringify([...newDismissed]));
  };

  if (!notifications || !Array.isArray(notifications) || notifications.length === 0) return null;

  // Filter out dismissed notifications
  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id));

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visibleNotifications
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map((notification) => (
          <div
            key={notification.id}
            className="bg-white border-l-4 border-green-600 shadow-sm px-4 py-3 w-full animate-slide-down rounded-xl"
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <img
                  src="/assets/images/notification_icon.png"
                  alt="Email Icon"
                  className="w-10 h-10 object-contain drop-shadow-sm"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      New Reply from <span className="text-green-700">{notification.contact.name}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {notification.contact.company}
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-normal mb-1">
                        {(() => {
                          try {
                            const date = new Date(notification.timestamp);
                            return date.toLocaleString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            });
                          } catch (error) {
                            return 'Invalid date';
                          }
                        })()
                        }
                      </p>
                      <div className="flex items-center justify-end space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-500 font-normal">
                          Unread
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(notification.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-all rounded-full flex-shrink-0"
                      title="Dismiss"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};

export default HrReplyNotification;