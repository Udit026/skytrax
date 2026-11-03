"use client";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function ConfirmDialog({ open, title, body, confirmLabel = "Delete", busy, onConfirm, onCancel }: {
  open: boolean; title: string; body: React.ReactNode; confirmLabel?: string; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={busy ? undefined : onCancel} />
      <div className="relative card w-full max-w-md p-6 shadow-xl">
        <div className="flex gap-4">
          <div className="grid place-items-center size-10 shrink-0 rounded-full bg-red-50 text-red-600"><AlertTriangle className="size-5" /></div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted">{body}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
