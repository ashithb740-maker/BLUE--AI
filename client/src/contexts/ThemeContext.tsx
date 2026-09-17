import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  setTheme: (theme: Theme) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

const THEME_FIXES = `
/* Global BLUE theme + readable code blocks. */
[data-blue-theme="light"] { color-scheme: light; }
[data-blue-theme="dark"] { color-scheme: dark; }

/* Code must always have strong contrast. */
.blue-response pre,
.blue-response pre code,
.blue-response pre code span,
.prose pre,
.prose pre code,
.prose pre code span {
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
  opacity: 1 !important;
}
.blue-response pre,
.prose pre {
  background: #0b1220 !important;
  border: 1px solid rgba(96,165,250,.28) !important;
  box-shadow: 0 12px 35px rgba(0,0,0,.18);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: .9rem;
  line-height: 1.65;
}

/* Light theme applies consistently even to pages/components that use hard-coded dark Tailwind classes. */
html[data-blue-theme="light"] body { background: #f4f8fc !important; color: #10243a !important; }
html[data-blue-theme="light"] main,
html[data-blue-theme="light"] aside,
html[data-blue-theme="light"] header,
html[data-blue-theme="light"] section,
html[data-blue-theme="light"] footer,
html[data-blue-theme="light"] nav {
  --tw-bg-opacity: 1;
}
html[data-blue-theme="light"] [class*="bg-[#08090d]"],
html[data-blue-theme="light"] [class*="bg-[#0b0d12]"],
html[data-blue-theme="light"] [class*="bg-[#0d0f15]"],
html[data-blue-theme="light"] [class*="bg-[#11131a]"],
html[data-blue-theme="light"] [class*="bg-[#171a22]"] {
  background-color: #ffffff !important;
}
html[data-blue-theme="light"] [class*="bg-white/[.025]"],
html[data-blue-theme="light"] [class*="bg-white/[.03]"],
html[data-blue-theme="light"] [class*="bg-white/[.04]"],
html[data-blue-theme="light"] [class*="bg-white/[.045]"],
html[data-blue-theme="light"] [class*="bg-white/[.055]"],
html[data-blue-theme="light"] [class*="bg-white/[.06]"] {
  background-color: rgba(15,80,130,.045) !important;
}
html[data-blue-theme="light"] [class*="text-white"] { color: #16324a !important; }
html[data-blue-theme="light"] [class*="text-white/"],
html[data-blue-theme="light"] [class*="text-white/[."] { color: #587087 !important; }
html[data-blue-theme="light"] [class*="border-white"] { border-color: rgba(14,88,150,.16) !important; }
html[data-blue-theme="light"] .blue-response h1,
html[data-blue-theme="light"] .blue-response h2,
html[data-blue-theme="light"] .blue-response h3,
html[data-blue-theme="light"] .blue-response strong { color: #10243a !important; }
html[data-blue-theme="light"] .blue-response blockquote { color: #526b80 !important; }
html[data-blue-theme="light"] .blue-response table { border-color: rgba(14,88,150,.16); }
html[data-blue-theme="light"] .blue-response th { background: #edf5fb; color: #16324a; }
html[data-blue-theme="light"] .blue-response td { border-color: rgba(14,88,150,.10); }
html[data-blue-theme="light"] .blue-response pre,
html[data-blue-theme="light"] .prose pre { background: #f8fbff !important; border-color: rgba(14,88,150,.20) !important; }
html[data-blue-theme="light"] .blue-response pre,
html[data-blue-theme="light"] .blue-response pre code,
html[data-blue-theme="light"] .blue-response pre code span,
html[data-blue-theme="light"] .prose pre,
html[data-blue-theme="light"] .prose pre code,
html[data-blue-theme="light"] .prose pre code span {
  color: #10243a !important;
  -webkit-text-fill-color: #10243a !important;
}
`;

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.blueTheme = theme;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    if (switchable) localStorage.setItem("theme", theme);

    const styleId = "blue-global-theme-fixes";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = THEME_FIXES;
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => setTheme(prev => (prev === "light" ? "dark" : "light"))
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
