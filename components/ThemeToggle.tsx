"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("hinterland-theme", next ? "dark" : "light");
    } catch {
      // stockage indisponible : le thème reste appliqué pour la session
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
      className={`rounded border px-3 py-1 text-sm transition-colors duration-150 ${className}`}
    >
      {dark === null ? "Thème" : dark ? "☀ Mode clair" : "☾ Mode sombre"}
    </button>
  );
}
