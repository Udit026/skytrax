import { Plane } from "lucide-react";

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid place-items-center size-9 rounded-lg bg-gradient-to-br from-brand to-sky text-white shadow-sm">
        <Plane className="size-[18px] -rotate-45" strokeWidth={2.2} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Skytrax Survey</div>
          <div className="text-[11px] text-muted">Delhi Airport · DIAL</div>
        </div>
      )}
    </div>
  );
}
