import { notFound } from "next/navigation";
import SubmissionDetailView from "@/components/SubmissionDetailView";
import { requireUserPage } from "@/lib/auth";
import { getSubmission } from "@/lib/submissions";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUserPage();
  const s = await getSubmission((await params).id);
  if (!s) notFound();
  return <SubmissionDetailView s={s} isAdmin={me.role === "admin"} />;
}
