import { useEffect, useState } from "react";

function initialDark(): boolean {
  const saved = localStorage.getItem("cbl-theme");
  if (saved) return saved === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(initialDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("cbl-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      className="rounded-token border border-border px-3 py-1.5 text-sm text-text"
      aria-pressed={dark}
    >
      {dark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
