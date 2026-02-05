// Singleton AudioContext to persist permission across background tabs
let audioCtx = null;

export const playNotificationSound = () => {
  // Check if email notifications are enabled in localStorage
  const emailNotificationsEnabled = localStorage.getItem('emailNotifications');

  // If explicitly set to false, don't play sound
  if (emailNotificationsEnabled === 'false') {
    console.log('Notification sound skipped - notifications disabled');
    return;
  }

  try {
    const audio = new Audio(`/assets/sounds/custom_alert.mp3?t=${new Date().getTime()}`);
    audio.play().catch(error => {
      console.warn('Audio playback failed (browser policy):', error);
    });
  } catch (error) {
    console.warn('Notification sound failed:', error);
  }
};