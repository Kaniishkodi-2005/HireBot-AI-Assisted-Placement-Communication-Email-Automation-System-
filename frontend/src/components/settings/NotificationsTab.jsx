import React, { useState } from 'react';
import { Bell, Check } from 'lucide-react';

export default function NotificationsTab() {
  // Load from localStorage with fallback defaults
  const [emailNotifs, setEmailNotifs] = useState(() => {
    const saved = localStorage.getItem('emailNotifications');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [pushNotifs, setPushNotifs] = useState(() => {
    const saved = localStorage.getItem('pushNotifications');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [marketingEmails, setMarketingEmails] = useState(() => {
    const saved = localStorage.getItem('marketingEmails');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Handlers that save to localStorage
  const handleEmailNotifsChange = (value) => {
    setEmailNotifs(value);
    localStorage.setItem('emailNotifications', JSON.stringify(value));
  };

  const handlePushNotifsChange = (value) => {
    setPushNotifs(value);
    localStorage.setItem('pushNotifications', JSON.stringify(value));
  };

  const handleMarketingEmailsChange = (value) => {
    setMarketingEmails(value);
    localStorage.setItem('marketingEmails', JSON.stringify(value));
  };

  const Toggle = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between py-6 border-b border-gray-100 dark:border-slate-700 last:border-0">
      <div className="flex-1 pr-8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#AF69F8] focus:ring-offset-2 ${checked ? 'bg-[#AF69F8]' : 'bg-gray-200 dark:bg-slate-700'
          }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-200">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage how you receive alerts</p>
          </div>
          <Bell className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        </div>

        <div className="px-6">
          <Toggle
            label="Email Notifications"
            description="Receive emails about new HR replies and important updates."
            checked={emailNotifs}
            onChange={handleEmailNotifsChange}
          />
          <Toggle
            label="Push Notifications"
            description="Receive real-time alerts on your desktop."
            checked={pushNotifs}
            onChange={handlePushNotifsChange}
          />
          <Toggle
            label="Marketing & Tips"
            description="Receive occasional tips on how to improve your placement rate."
            checked={marketingEmails}
            onChange={handleMarketingEmailsChange}
          />
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900 text-right">
          <button disabled className="text-xs text-gray-400 dark:text-gray-500 font-medium cursor-not-allowed">Changes are auto-saved</button>
        </div>
      </div>
    </div>
  );
}
