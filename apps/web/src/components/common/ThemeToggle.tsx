import React from 'react';
import { useTheme } from '../../context/ThemeContext.js';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-2xl border transition-all duration-200 text-xs font-semibold select-none shadow-sm cursor-pointer ${
        isDark
          ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-100 border-slate-700 hover:border-slate-600 shadow-slate-950/40'
          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-slate-200/50'
      } ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      {/* Sliding pill switch container */}
      <div className="relative w-8 h-4.5 bg-slate-200 dark:bg-slate-700/90 rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0">
        <div
          className={`w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform duration-200 flex items-center justify-center ${
            isDark
              ? 'translate-x-3.5 bg-amber-400 text-slate-950'
              : 'translate-x-0 bg-white text-amber-500'
          }`}
        >
          {isDark ? (
            <Moon className="w-2.5 h-2.5 fill-current" />
          ) : (
            <Sun className="w-2.5 h-2.5 fill-current" />
          )}
        </div>
      </div>
      {showLabel && (
        <span className="font-semibold text-xs tracking-wide">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
};

