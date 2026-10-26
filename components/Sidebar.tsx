"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/coms", label: "Analyse par COM" },
  { href: "/details", label: "Détail des dossiers" },
  { href: "/evolution", label: "Évolution" },
  { href: "/import", label: "Import des données" },
];

export default function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (pathname === "/login") return null;

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex h-12 items-center justify-between bg-[#1D3259] px-4 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo_agl_or.png" alt="AGL" className="h-8 w-auto" />
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded border border-white/30 px-3 py-1 text-sm">
          {mobileOpen ? "Fermer" : "Menu"}
        </button>
      </div>
      {!open && (
        <button
          onClick={onToggle}
          title="Afficher le menu"
          aria-label="Afficher le menu"
          className="hidden lg:flex fixed left-3 top-3 z-30 h-9 w-9 items-center justify-center rounded bg-[#1D3259] text-white shadow-md hover:bg-[#16263f] dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          ▶
        </button>
      )}
      <aside
        className={`fixed z-20 inset-y-0 left-0 w-64 transform bg-[#1D3259] text-white transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${open ? "lg:translate-x-0" : "lg:-translate-x-full"}`}
      >
        <button
          onClick={onToggle}
          title="Réduire le menu"
          aria-label="Réduire le menu"
          className="hidden lg:flex absolute right-2 top-2 h-7 w-7 items-center justify-center rounded bg-white/10 text-xs hover:bg-white/20"
        >
          ◀
        </button>
        <div className="flex flex-col items-center border-b border-white/10 px-5 pb-4 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo_agl_or.png" alt="AGL — Africa Global Logistics" className="h-auto w-36" />
          <div className="mt-2 text-center text-xs text-slate-300">Pilotage des dossiers en retard</div>
        </div>
        <nav className="p-3 space-y-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded px-3 py-2 text-sm transition-colors duration-150 ${
                  active ? "bg-white font-semibold text-marine-900 dark:bg-gold-300" : "hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 text-xs text-slate-300">
          <div className="mb-3">
            Seuils SPOT — Air : 5 j · Maritime & Route locale : 10 j · Hinterland : 15 j
          </div>
          <div className="flex items-center justify-between gap-2">
            <button onClick={logout} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
              Déconnexion
            </button>
            <ThemeToggle className="border-white/30 bg-white/5 text-white/90 hover:bg-white/15" />
          </div>
        </div>
      </aside>
    </>
  );
}
