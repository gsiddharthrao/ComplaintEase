import React from 'react';
import { useTheme } from '../../context/ThemeContext.js';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 text-xs font-medium ${
        theme === 'dark'
          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 hover:border-slate-600 shadow-sm'
          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
      } ${className}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400 rotate-0 transition-transform duration-300" />
        ) : (
          <Moon className="w-4 h-4 text-slate-600 -rotate-12 transition-transform duration-300" />
        )}
      </div>
      {showLabel && (
        <span className="font-semibold">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      )}
    </button>
  );
};
