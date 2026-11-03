import { PageHeader } from "@/components/ui";
import AnalyticsView from "@/components/AnalyticsView";
import { getAnalytics } from "@/lib/analytics";

export default async function AnalyticsPage() {
  const initial = await getAnalytics();
  return (
    <>
      <PageHeader title="Analytics" subtitle="Submission momentum, respondent reach and verification progress. All dates in IST." />
      <AnalyticsView initial={initial} today={initial.range.to} />
    </>
  );
}
