import { PageHeader } from "@/components/ui";
import UploadForm from "@/components/UploadForm";
import { requireAdminPage } from "@/lib/auth";

export default async function UploadPage() {
  await requireAdminPage(); // viewers are redirected to the overview
  return (
    <>
      <PageHeader title="Upload submission" subtitle="Record a survey submission with its screenshot proof. Files are validated server-side and stored with unique names." />
      <UploadForm maxMb={Number(process.env.MAX_UPLOAD_MB ?? 10)} maxFiles={Number(process.env.MAX_FILES_PER_SUBMISSION ?? 10)} />
    </>
  );
}
