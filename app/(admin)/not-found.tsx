import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card p-10 text-center max-w-lg mx-auto mt-10">
      <h2 className="font-semibold">Not found</h2>
      <p className="mt-1 text-sm text-muted">This submission doesn&apos;t exist or was deleted.</p>
      <Link href="/submissions" className="btn-primary mt-5">Back to submissions</Link>
    </div>
  );
}
