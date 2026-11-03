"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, X } from "lucide-react";
import { fmtBytes, fmtDateTime } from "@/lib/format";

export type Shot = { id: string; original_filename: string; file_size: number; width?: number | null; height?: number | null; uploaded_at?: string };

/** Full-resolution viewer. Image is rendered with object-contain at its natural aspect ratio — never cropped. */
export default function Lightbox({ shots, index, onClose, title, apiBase = "/api" }: { shots: Shot[]; index: number; onClose: () => void; title?: string; apiBase?: string }) {
  const [i, setI] = useState(index);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const shot = shots[i];
  const go = useCallback((d: number) => { setLoaded(false); setFailed(false); setI((v) => (v + d + shots.length) % shots.length); }, [shots.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && shots.length > 1) go(1);
      if (e.key === "ArrowLeft" && shots.length > 1) go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, go, shots.length]);

  if (!shot) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b1220]/95 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14 text-white/90 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{shot.original_filename}</div>
          <div className="text-xs text-white/50 truncate">
            {title ? `${title} · ` : ""}{fmtBytes(shot.file_size)}{shot.width ? ` · ${shot.width}×${shot.height}px` : ""}
            {shot.uploaded_at ? ` · ${fmtDateTime(shot.uploaded_at)}` : ""}{shots.length > 1 ? ` · ${i + 1} of ${shots.length}` : ""}
          </div>
        </div>
        <a href={`${apiBase}/files/${shot.id}`} target="_blank" rel="noopener" className="btn bg-white/10 text-white hover:bg-white/20 hidden sm:inline-flex"><ExternalLink className="size-4" /> Open</a>
        <a href={`${apiBase}/files/${shot.id}?dl=1`} className="btn bg-white text-ink hover:bg-white/90"><Download className="size-4" /> Download</a>
        <button onClick={onClose} className="btn bg-white/10 text-white hover:bg-white/20 px-2.5" aria-label="Close"><X className="size-5" /></button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
        {!loaded && !failed && <Loader2 className="absolute size-8 animate-spin text-white/60" />}
        {failed && <div className="text-white/70 text-sm">Could not load this screenshot from storage.</div>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={shot.id} src={`${apiBase}/files/${shot.id}`} alt={shot.original_filename}
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} onClick={(e) => e.stopPropagation()}
          className={`max-h-full max-w-full w-auto h-auto object-contain rounded-md shadow-2xl transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`} />
        {shots.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-3 sm:left-6 grid place-items-center size-11 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Previous"><ChevronLeft /></button>
            <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-3 sm:right-6 grid place-items-center size-11 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Next"><ChevronRight /></button>
          </>
        )}
      </div>
    </div>
  );
}
