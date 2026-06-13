'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme) ?? 'dark';
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      applyTheme(next);
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

function applyTheme(t: Theme) {
  const r = document.documentElement;
  if (t === 'light') { r.classList.remove('dark'); r.classList.add('light'); }
  else               { r.classList.remove('light'); r.classList.add('dark'); }
}

export const useTheme = () => useContext(ThemeContext);