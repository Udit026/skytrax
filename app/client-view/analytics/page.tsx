import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import AnalyticsView from "@/components/AnalyticsView";
import { getAnalytics } from "@/lib/analytics";
import { clientSlug } from "@/lib/client-slug";

export default async function ClientAnalytics() {
  // CLIENT-HIDE: restore by removing hideAnalytics (set it to false)
  const hideAnalytics = true;
  if (hideAnalytics) redirect(`/${clientSlug()}`);

  const initial = await getAnalytics();
  return (
    <>
      <PageHeader title="Analytics" subtitle="Submission momentum, respondent reach and verification progress. All dates in IST." />
      <AnalyticsView initial={initial} today={initial.range.to} apiBase="/api/client" />
    </>
  );
}
