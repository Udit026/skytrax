"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Table2, UploadCloud, BarChart3, Settings, LogOut, Menu, X } from "lucide-react";
import Brand from "./Brand";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/submissions", label: "All Submissions", icon: Table2 },
  { href: "/upload", label: "Upload Submission", icon: UploadCloud, adminOnly: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Users & Settings", icon: Settings, adminOnly: true },
];

export default function Sidebar({ name, email, role }: { name: string; email: string; role: "admin" | "viewer" }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  const body = (
    <div className="flex h-full flex-col">
      <div className="px-5 h-16 flex items-center border-b border-line"><Brand /></div>
      <nav className="flex-1 p-3 space-y-0.5">
        <div className="px-3 pt-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Campaign</div>
        {NAV.filter((n) => !n.adminOnly || role === "admin").map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 h-9 text-sm transition-colors ${
              active(href) ? "bg-brand-50 text-brand font-semibold" : "text-muted hover:bg-page hover:text-ink"}`}>
            <Icon className="size-[18px]" strokeWidth={active(href) ? 2.3 : 2} />
            {label}
          </Link>
        ))}
        <form action="/api/auth/logout" method="post">
          <button className="w-full flex items-center gap-3 rounded-lg px-3 h-9 text-sm text-muted hover:bg-red-50 hover:text-red-700">
            <LogOut className="size-[18px]" /> Logout
          </button>
        </form>
      </nav>
      <div className="m-3 rounded-lg border border-line p-3 flex items-center gap-3">
        <div className="grid place-items-center size-8 rounded-full bg-ink text-white text-xs font-semibold">
          {name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
          <div className="text-xs text-muted truncate">{role === "admin" ? email : `Client · ${email}`}</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-line z-30">{body}</aside>
      <div className="lg:hidden sticky top-0 z-30 h-14 bg-white border-b border-line flex items-center justify-between px-4">
        <Brand />
        <button className="btn-ghost px-2.5" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button className="absolute right-3 top-3.5 btn-ghost px-2" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-4" /></button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
