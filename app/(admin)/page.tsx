import OverviewView from "@/components/OverviewView";
import { requireUserPage } from "@/lib/auth";

export default async function Overview() {
  const me = await requireUserPage();
  return <OverviewView isAdmin={me.role === "admin"} />;
}
