"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/coms", label: "Analyse par COM" },
  { href: "/details", label: "Détail des dossiers" },
  { href: "/evolution", label: "Évolution" },
  { href: "/import", label: "Import des données" },
];

/** Barre d'application du référentiel : logo, entrées en petites capitales, thème, déconnexion. Pas de barre latérale. */
export default function AppBar() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/login") return null;

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="AGL Overdue, accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo_agl_bleu.png" alt="AGL" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo_agl_or_transparent.png" alt="" aria-hidden="true" className="hidden h-8 w-auto dark:block" />
          <span className="hidden border-l-2 border-acc pl-3 text-sm font-extrabold leading-tight text-titre md:block">
            Overdue
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-mut">Dossiers en retard</span>
          </span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Navigation principale">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`h-14 shrink-0 whitespace-nowrap px-3 text-[11px] font-bold uppercase leading-[3.5rem] tracking-[0.12em] transition-colors ${
                  active ? "text-acc shadow-[inset_0_-3px_0_var(--acc)]" : "text-ink hover:text-acc"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle className="shrink-0 border-line bg-panel text-ink hover:border-acc" />
        <button onClick={logout} className="shrink-0 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-acc">
          Déconnexion
        </button>
      </div>
    </header>
  );
}
