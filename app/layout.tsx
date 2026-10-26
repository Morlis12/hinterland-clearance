import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "AGL Overdue Files Monitoring — Pilotage des dossiers en retard",
  description: "Suivi des dossiers en retard à partir des extractions Excel SPOT (AGL Overdue Files Monitoring).",
  icons: { icon: "/favicon.svg" },
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("hinterland-theme");if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <div aria-hidden className="pointer-events-none fixed bottom-1.5 right-3 z-40 text-[11px] tracking-wide text-mut opacity-80">made by KPD</div>
      </body>
    </html>
  );
}
