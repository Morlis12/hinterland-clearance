"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppBar from "./AppBar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login";
  return (
    <div className="min-h-screen">
      <AppBar />
      <main>
        <div className={bare ? "" : "mx-auto max-w-7xl p-4 md:p-6"}>{children}</div>
      </main>
    </div>
  );
}
