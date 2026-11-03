import { PageHeader } from "@/components/ui";
import SettingsView from "@/components/SettingsView";
import { requireAdminPage } from "@/lib/auth";
import { q } from "@/lib/db";

export default async function SettingsPage() {
  const me = await requireAdminPage();
  const admins = await q<{ id: string; name: string; email: string; role: "admin" | "viewer"; created_at: string; last_login_at: string | null }>(
    "SELECT id, name, email, role, created_at, last_login_at FROM admins ORDER BY role, created_at");
  return (
    <>
      <PageHeader title="Users & settings" subtitle="Manage admins and read-only client accounts for the campaign dashboard." />
      <SettingsView admins={JSON.parse(JSON.stringify(admins))} meId={me.sub} />
    </>
  );
}
