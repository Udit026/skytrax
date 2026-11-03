import SubmissionsListView from "@/components/SubmissionsListView";
import { requireUserPage } from "@/lib/auth";

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUserPage();
  return <SubmissionsListView searchParams={searchParams} isAdmin={me.role === "admin"} />;
}
