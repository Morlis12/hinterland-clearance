import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "AGL Overdue Files Monitoring — Pilotage des dossiers en retard",
  description: "Suivi des dossiers en retard à partir des extractions Excel SPOT (AGL Overdue Files Monitoring).",
  icons: { icon: "/favicon.svg" },
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("hinterland-theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
