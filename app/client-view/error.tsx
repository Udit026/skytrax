"use client";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card p-10 text-center max-w-lg mx-auto mt-10">
      <div className="mx-auto grid place-items-center size-12 rounded-full bg-red-50 text-red-600"><AlertTriangle className="size-6" /></div>
      <h2 className="mt-4 font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted">
        The server could not complete this request. Please try again in a moment.
        {error.digest && <span className="block mt-1 font-mono text-xs text-faint">Ref: {error.digest}</span>}
      </p>
      <button className="btn-primary mt-5" onClick={reset}>Try again</button>
    </div>
  );
}
