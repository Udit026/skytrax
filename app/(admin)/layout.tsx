import { Eye } from "lucide-react";
import { requireUserPage } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUserPage();
  const viewer = s.role !== "admin";
  return (
    <div className="min-h-screen">
      <Sidebar name={s.name} email={s.email} role={s.role} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {viewer && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
              <Eye className="size-4 mt-0.5 shrink-0" />
              <span><b>View-only access.</b> You can review every submission and screenshot, and download screenshots and reports. Changes are managed by the campaign team.</span>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
