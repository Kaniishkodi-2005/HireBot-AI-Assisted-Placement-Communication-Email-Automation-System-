import { useEffect, useState } from 'react';

const HrReplyNotification = ({ notifications, onDismiss }) => {
  const [playedSounds, setPlayedSounds] = useState(() => {
    // Initialize from localStorage to persist across page navigations
    const stored = localStorage.getItem('hrNotificationSounds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Play notification sound for new notifications
  useEffect(() => {
    let hasNewSound = false;
    const newPlayedSounds = new Set(playedSounds);
    
    notifications.forEach(notification => {
      if (!playedSounds.has(notification.id)) {
        playNotificationSound();
        newPlayedSounds.add(notification.id);
        hasNewSound = true;
      }
    });
    
    if (hasNewSound) {
      setPlayedSounds(newPlayedSounds);
      // Save to localStorage
      localStorage.setItem('hrNotificationSounds', JSON.stringify([...newPlayedSounds]));
    }
  }, [notifications, playedSounds]);

  const playNotificationSound = () => {
    try {
      // Create a simple notification beep using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  const handleViewConversation = (notification) => {
    onViewConversation(notification.contact);
    onDismiss(notification.id);
  };

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {notifications
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map((notification) => (
        <div
          key={notification.id}
          className="bg-white border-l-4 border-green-600 shadow-sm px-6 py-4 w-full animate-slide-down rounded-xl"
        >
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    New Reply from <span className="text-green-700">{notification.contact.name}</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {notification.contact.company}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-normal mb-2">
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
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HrReplyNotification;