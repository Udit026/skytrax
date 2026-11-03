"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, UserPlus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { fmtDateTime } from "@/lib/format";

type Admin = { id: string; name: string; email: string; role: "admin" | "viewer"; created_at: string; last_login_at: string | null };

function useForm<T extends Record<string, string>>(init: T) {
  const [v, setV] = useState(init);
  return { v, set: (k: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value })), reset: () => setV(init) };
}

export default function SettingsView({ admins, meId }: { admins: Admin[]; meId: string }) {
  const router = useRouter();
  const pw = useForm({ current: "", next: "", confirm: "" });
  const na = useForm({ name: "", email: "", password: "" });
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [naMsg, setNaMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [del, setDel] = useState<Admin | null>(null);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.v.next !== pw.v.confirm) return setPwMsg({ ok: false, t: "New passwords do not match." });
    setBusy("pw");
    const r = await fetch("/api/admins/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: pw.v.current, next: pw.v.next }) });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    setPwMsg(r.ok ? { ok: true, t: "Password updated." } : { ok: false, t: j.error || "Failed" });
    if (r.ok) pw.reset();
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy("na");
    const r = await fetch("/api/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...na.v, role }) });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    setNaMsg(r.ok ? { ok: true, t: `${na.v.email} can now sign in as ${role === "viewer" ? "a read-only client" : "an admin"}.` } : { ok: false, t: j.error || "Failed" });
    if (r.ok) { na.reset(); router.refresh(); }
  }

  async function removeAdmin() {
    if (!del) return;
    setBusy("del");
    const r = await fetch(`/api/admins/${del.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setBusy(""); setDel(null);
    if (!r.ok) setNaMsg({ ok: false, t: j.error || "Failed" });
    router.refresh();
  }

  const Msg = ({ m }: { m: { ok: boolean; t: string } | null }) => m && <div className={`rounded-lg px-3 py-2 text-sm ${m.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{m.t}</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-brand" /> Users</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Last sign-in</th><th className="th">Added</th><th className="th" /></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="td font-medium">{a.name}{a.id === meId && <span className="ml-2 text-[11px] rounded bg-brand-50 text-brand px-1.5 py-0.5">You</span>}</td>
                  <td className="td text-muted">{a.email}</td>
                  <td className="td"><span className={`text-xs whitespace-nowrap rounded-full px-2 py-0.5 ring-1 ring-inset ${a.role === "admin" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-sky-50 text-sky-700 ring-sky-200"}`}>{a.role === "admin" ? "Admin" : "Client"}</span></td>
                  <td className="td text-muted whitespace-nowrap">{a.last_login_at ? fmtDateTime(a.last_login_at) : "Never"}</td>
                  <td className="td text-muted whitespace-nowrap">{fmtDateTime(a.created_at)}</td>
                  <td className="td text-right">{a.id !== meId && <button className="btn-danger h-8 px-2.5" onClick={() => setDel(a)} aria-label="Remove user"><Trash2 className="size-3.5" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={addAdmin} className="p-5 border-t border-line">
          <div className="font-semibold flex items-center gap-2 mb-3"><UserPlus className="size-4" /> Add user</div>
          <div className="mb-3 flex gap-2 text-sm">
            {([["viewer", "Client (view-only + downloads)"], ["admin", "Admin (full access)"]] as const).map(([v, l]) => (
              <label key={v} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 ${role === v ? "border-brand bg-brand-50 font-medium" : "border-line"}`}>
                <input type="radio" name="role" className="mr-2" checked={role === v} onChange={() => setRole(v)} />{l}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="input" placeholder="Full name" required value={na.v.name} onChange={na.set("name")} />
            <input className="input" type="email" placeholder="Email" required value={na.v.email} onChange={na.set("email")} />
            <input className="input" type="password" placeholder="Temporary password (10+ chars)" minLength={10} required autoComplete="new-password" value={na.v.password} onChange={na.set("password")} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button className="btn-primary" disabled={busy === "na"}>{busy === "na" && <Loader2 className="size-4 animate-spin" />} Add user</button>
            <Msg m={naMsg} />
          </div>
        </form>
      </div>

      <form onSubmit={changePw} className="card p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><KeyRound className="size-4" /> Change your password</div>
        <div><label className="label">Current password</label><input type="password" className="input" required autoComplete="current-password" value={pw.v.current} onChange={pw.set("current")} /></div>
        <div><label className="label">New password</label><input type="password" className="input" required minLength={10} autoComplete="new-password" value={pw.v.next} onChange={pw.set("next")} /></div>
        <div><label className="label">Confirm new password</label><input type="password" className="input" required minLength={10} autoComplete="new-password" value={pw.v.confirm} onChange={pw.set("confirm")} /></div>
        <Msg m={pwMsg} />
        <button className="btn-primary w-full" disabled={busy === "pw"}>{busy === "pw" && <Loader2 className="size-4 animate-spin" />} Update password</button>
        <p className="text-xs text-muted">Passwords are hashed with bcrypt (cost 12). Sessions expire after {process.env.NEXT_PUBLIC_SESSION_HOURS ?? 12} hours.</p>
      </form>

      <ConfirmDialog open={!!del} busy={busy === "del"} title="Remove user?" confirmLabel="Remove"
        body={<><b>{del?.email}</b> will lose access immediately.</>} onConfirm={removeAdmin} onCancel={() => setDel(null)} />
    </div>
  );
}
