"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import Brand from "@/components/Brand";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Sign in failed");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-[400px] p-8">
      <Brand />
      <h1 className="mt-8 text-xl font-semibold tracking-tight">Admin sign in</h1>
      <p className="mt-1 text-sm text-muted">Authorised campaign administrators only.</p>
      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required className="input h-10" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input h-10" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{err}</div>}
        <button className="btn-primary w-full h-10" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Sign in
        </button>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1fr_520px]">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-[radial-gradient(1200px_600px_at_0%_0%,#dbe7ff_0%,transparent_60%),linear-gradient(160deg,#0f1b2d,#13284d)] text-white">
        <div className="text-sm text-white/60 tracking-wide uppercase">Skytrax World Airport Awards · Passenger Survey</div>
        <div>
          <h2 className="text-4xl font-semibold tracking-tight leading-tight max-w-lg">Campaign operations for Indira Gandhi International Airport.</h2>
          <p className="mt-4 text-white/70 max-w-md">Record survey submissions, verify screenshots and track respondent momentum in one place.</p>
        </div>
        <div className="text-xs text-white/40">DIAL · GMR Airports</div>
      </section>
      <section className="flex items-center justify-center p-6">
        <Suspense><LoginForm /></Suspense>
      </section>
    </main>
  );
}
