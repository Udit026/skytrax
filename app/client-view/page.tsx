import OverviewView from "@/components/OverviewView";
import { clientSlug } from "@/lib/client-slug";

export default function ClientOverview() {
  return <OverviewView isAdmin={false} basePath={`/${clientSlug()}`} />;
}
