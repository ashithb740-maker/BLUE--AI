import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-1 rounded-xl border border-white/10 bg-black/50 p-1 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#11131a]/90">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Use light theme"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition ${theme === "light" ? "bg-white text-slate-900 shadow-sm" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
      >
        <Sun className="size-3.5" /> Light
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Use dark theme"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition ${theme === "dark" ? "bg-blue-500 text-white shadow-sm" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
      >
        <Moon className="size-3.5" /> Dark
      </button>
    </div>
  );
}
