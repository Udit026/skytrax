"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Table2, BarChart3, Eye } from "lucide-react";
import Brand from "./Brand";

const NAV = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/submissions", label: "All Submissions", icon: Table2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

/** Top navigation for the public, read-only client view. No login, upload, settings or review links. */
export default function ClientNav({ basePath }: { basePath: string }) {
  const path = usePathname();
  const active = (h: string) => (h === "" ? path === basePath : path.startsWith(basePath + h));

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 flex flex-wrap items-center gap-x-6 gap-y-1 min-h-16 py-2">
        <Link href={basePath || "/"} aria-label="Overview"><Brand /></Link>
        <nav className="order-last sm:order-none w-full sm:w-auto flex gap-0.5 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={`${basePath}${href}` || "/"}
              className={`shrink-0 flex items-center gap-2 rounded-lg px-3 h-9 text-sm transition-colors ${
                active(href) ? "bg-brand-50 text-brand font-semibold" : "text-muted hover:bg-page hover:text-ink"}`}>
              <Icon className="size-[18px]" strokeWidth={active(href) ? 2.3 : 2} />
              {label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
          <Eye className="size-3.5" /> View-only
        </span>
      </div>
    </header>
  );
}
