"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login";
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem("hinterland-sidebar-open");
      if (v !== null) setOpen(v === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem("hinterland-sidebar-open", next ? "1" : "0");
      } catch {}
      return next;
    });
  return (
    <div className="flex min-h-screen">
      <Sidebar open={open} onToggle={toggle} />
      <main className={`flex-1 min-w-0 transition-[margin] duration-200 ${bare ? "" : open ? "lg:ml-64" : "lg:ml-0"}`}>
        <div className={bare ? "" : `mx-auto max-w-7xl p-4 pt-16 md:p-6 md:pt-16 ${open ? "lg:pt-6" : "lg:pt-16"}`}>{children}</div>
      </main>
    </div>
  );
}
