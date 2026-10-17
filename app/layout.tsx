import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "HINTERLAND — Pilotage des dossiers en retard",
  description: "Suivi des dossiers opérationnels HINTERLAND en retard (extractions SPOT).",
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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 lg:ml-64">
            <div className="mx-auto max-w-7xl p-4 pt-16 md:p-6 md:pt-16 lg:pt-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
