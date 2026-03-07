"use client";

import { useTheme } from "@/components/theme-provider";
import { MoonIcon, SunIcon } from "@/components/icons";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors duration-300 ${
        isDark
          ? "border-red-400/60 bg-red-900/60"
          : "border-zinc-400/80 bg-zinc-200"
      }`}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-pressed={isDark}
    >
      <span className={`absolute left-1 transition-opacity ${isDark ? "opacity-40" : "opacity-100"}`}>
        <SunIcon className="h-3.5 w-3.5 text-amber-500" />
      </span>
      <span className={`absolute right-1 transition-opacity ${isDark ? "opacity-100" : "opacity-40"}`}>
        <MoonIcon className="h-3.5 w-3.5 text-zinc-100" />
      </span>
      <span
        className={`absolute top-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-transform duration-300 ${
          isDark
            ? "translate-x-6 border-zinc-700 bg-zinc-950 text-zinc-100"
            : "translate-x-0.5 border-zinc-300 bg-white text-amber-500"
        }`}
      >
        {isDark ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
      </span>
      <span className="sr-only">{isDark ? "Tema oscuro activo" : "Tema claro activo"}</span>
    </button>
  );
}
