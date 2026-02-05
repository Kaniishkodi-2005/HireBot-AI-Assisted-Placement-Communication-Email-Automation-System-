import { useState, useEffect } from 'react';
import { Moon, Sun, Laptop } from 'lucide-react';

export default function AppearanceTab() {
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'
  );

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove both potential classes to start fresh
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const themes = [
    { id: 'light', label: 'Light Mode', icon: Sun },
    { id: 'dark', label: 'Dark Mode', icon: Moon },
    { id: 'system', label: 'System Default', icon: Laptop },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Theme Preferences</h2>

        <div className="grid grid-cols-3 gap-4">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${theme === t.id
                ? 'border-[#AF69F8] bg-purple-50 dark:bg-slate-700 text-[#AF69F8]'
                : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-200 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
            >
              <div className={`p-3 rounded-full ${theme === t.id ? 'bg-purple-100 dark:bg-slate-600' : 'bg-gray-100 dark:bg-slate-700'
                }`}>
                <t.icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold">{t.label}</span>

              {theme === t.id && (
                <div className="absolute top-3 right-3 text-[#AF69F8]">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#AF69F8]"></div>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-8 p-4 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Preview</h3>
          <div className={`p-4 rounded-lg border shadow-sm flex items-center justify-between ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
            }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
              <div className="space-y-1">
                <div className={`h-2 w-24 rounded ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                <div className={`h-2 w-16 rounded ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
              </div>
            </div>
            <button className={`px-3 py-1 text-xs rounded font-medium ${theme === 'dark' ? 'bg-[#AF69F8] text-white' : 'bg-[#AF69F8] text-white'
              }`}>Button</button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            * This is a visual preview.
          </p>
        </div>
      </div>
    </div>
  );
}
