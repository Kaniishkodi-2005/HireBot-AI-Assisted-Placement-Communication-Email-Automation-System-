import { useState } from 'react';
import { User, Bell, Shield, Moon, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ProfileAccountTab from '../components/settings/ProfileAccountTab';
import NotificationsTab from '../components/settings/NotificationsTab';
import SecurityTab from '../components/settings/SecurityTab';
import AppearanceTab from '../components/settings/AppearanceTab';
import DangerZoneTab from '../components/settings/DangerZoneTab';
import { useAuth } from '../context/authContext';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  const tabs = [
    { id: 'profile', label: 'Profile & Account', icon: User, component: ProfileAccountTab },
    { id: 'notifications', label: 'Notifications', icon: Bell, component: NotificationsTab },
    { id: 'security', label: 'Security', icon: Shield, component: SecurityTab },
    { id: 'appearance', label: 'Appearance', icon: Moon, component: AppearanceTab },
  ];

  // Only show Danger Zone for non-admin users as per requirements
  if (!isAdmin) {
    tabs.push({ id: 'danger', label: 'Danger Zone', icon: AlertTriangle, component: DangerZoneTab, danger: true });
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ProfileAccountTab;

  // Determine back link based on role
  const backLink = user?.role === 'admin' ? '/dashboard/admin' : '/dashboard/hr';

  return (
    <div className="max-w-7xl mx-auto h-full md:h-[calc(100vh-theme(spacing.32))] bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row transition-colors duration-200">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700">
          <Link to={backLink} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#9333ea] dark:text-gray-400 dark:hover:text-[#9333ea] mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Settings</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage your account preferences</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-x-auto md:overflow-y-auto custom-scrollbar flex md:flex-col gap-2 md:gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-[#9333ea] ring-1 ring-purple-100 dark:ring-purple-900'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200 hover:shadow-sm'
                }
                ${tab.danger && activeTab !== tab.id ? 'text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20' : ''}
                ${tab.danger && activeTab === tab.id ? 'text-red-600 dark:text-red-400 ring-red-100 dark:ring-red-900/30' : ''}
              `}
            >
              <tab.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id
                ? (tab.danger ? 'text-red-500' : 'text-[#9333ea]')
                : (tab.danger ? 'text-red-400' : 'text-gray-400')
                }`} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 h-full">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="animate-fade-in pb-10 md:pb-0">
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  );
}
