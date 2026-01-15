'use client';

import { useTheme } from '@/components/ThemeProvider';
import { LuMoon, LuSun } from 'react-icons/lu';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-accent transition-colors"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <LuMoon className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      ) : (
        <LuSun className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      )}
    </button>
  );
}
