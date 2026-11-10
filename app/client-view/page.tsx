import OverviewView from "@/components/OverviewView";
import { clientSlug } from "@/lib/client-slug";

export default function ClientOverview() {
  // CLIENT-HIDE: restore by removing hideSubmissionDate / hideStatus / hideAnalytics / hideChart
  return <OverviewView isAdmin={false} basePath={`/${clientSlug()}`} hideSubmissionDate hideStatus hideAnalytics hideChart />;
}
