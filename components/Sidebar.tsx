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
      <button
        onClick={onToggle}
        title={open ? "Réduire le menu" : "Afficher le menu"}
        aria-label={open ? "Réduire le menu" : "Afficher le menu"}
        className={`hidden lg:flex fixed top-4 z-30 h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#1D3259] text-white shadow-md transition-all duration-300 ease-in-out hover:bg-[#27427A] ${
          open ? "left-[12rem]" : "left-3"
        }`}
      >
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform duration-300 ${open ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4l-6 6 6 6" />
        </svg>
      </button>
      <aside
        className={`fixed z-20 inset-y-0 left-0 w-52 transform bg-[#1D3259] text-white transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${open ? "lg:translate-x-0" : "lg:-translate-x-full"}`}
      >
        <div className="flex flex-col items-center border-b border-white/10 px-4 pb-3 pt-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo_agl_or.png" alt="AGL — Africa Global Logistics" className="h-auto w-28" />
          <div className="mt-2 text-center text-[11px] leading-tight text-slate-300">Pilotage des dossiers en retard</div>
        </div>
        <nav className="space-y-1 p-2">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded px-3 py-2 text-[13px] transition-colors duration-150 ${
                  active ? "bg-white font-semibold text-marine-900 dark:bg-gold-300" : "hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3 text-[11px] leading-snug text-slate-300">
          <div className="mb-2">
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
