import type { Metadata } from "next";
import { Eye } from "lucide-react";
import ClientNav from "@/components/ClientNav";
import { clientSlug } from "@/lib/client-slug";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Skytrax Survey · Delhi Airport",
  description: "Skytrax passenger survey campaign – client view",
  robots: { index: false, follow: false, noarchive: true },
};

/** Public, read-only client view. Served at /<CLIENT_VIEW_SLUG> via the middleware rewrite. */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const basePath = `/${clientSlug()}`;
  return (
    <div className="min-h-screen">
      <ClientNav basePath={basePath} />
      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
          <Eye className="size-4 mt-0.5 shrink-0" />
          <span><b>View-only access.</b> You can review every submission and screenshot, and download screenshots and reports. Changes are managed by the campaign team.</span>
        </div>
        {children}
      </main>
    </div>
  );
}
