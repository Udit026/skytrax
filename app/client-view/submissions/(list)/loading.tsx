export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-56 rounded bg-line" />
      <div className="mt-2 h-4 w-80 rounded bg-line/70" />
      <div className="card mt-6 h-[92px]" />
      <div className="card mt-4 p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded bg-page" />)}
      </div>
    </div>
  );
}
