import Link from "next/link";
import { MessageCircle, MoreHorizontal, Plus, QrCode, School } from "lucide-react";
import {
  AdminEmptyState,
  AdminPageHeader,
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSurfaceClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";
import { listClasses } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

interface GroupRow { id: string; class_id: string; name: string; invite_url: string; updated_at?: number | string | null }
interface StudentClassRow { class_id: string | null; status: string }

function formatUpdated(value: number | string | null | undefined) {
  if (!value) return "—";
  const date = new Date(typeof value === "number" ? value : value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

export default async function AdminClassesPage() {
  const { supabase, scope } = await currentStaff();
  const [classes, groupsResult, studentsResult] = await Promise.all([
    listClasses(supabase),
    supabase.from("whatsapp_groups").select("id,class_id,name,invite_url,updated_at").limit(300),
    supabase.from("users").select("class_id,status").eq("role", "student").limit(1000),
  ]);
  const groups = (groupsResult.data ?? []) as GroupRow[];
  const students = (studentsResult.data ?? []) as StudentClassRow[];
  const occupancy = new Map<string, number>();
  for (const student of students.filter((item) => item.status === "active" && item.class_id)) {
    occupancy.set(student.class_id!, (occupancy.get(student.class_id!) ?? 0) + 1);
  }
  const groupByClass = new Map(groups.map((group) => [group.class_id, group]));
  const classById = new Map(classes.map((item) => [item.id, item]));
  const active = classes.filter((item) => item.status === "active");

  return (
    <div>
      <AdminPageHeader
        eyebrow="Academic structure"
        title="Classes & communication"
        description="Manage class groups and attach one parent/student WhatsApp group to the intended class."
        actions={scope.isAdmin ? <>
          <Button render={<Link href="/admin/classes?modal=class-new" />} className={adminPrimaryButtonClass}><Plus className="size-4" />New class</Button>
          <Button render={<Link href="/admin/classes?modal=whatsapp-new" />} variant="outline" className={adminSecondaryButtonClass}><QrCode className="size-4" />Add WhatsApp group</Button>
        </> : null}
      />

      {active.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((item) => {
            const count = occupancy.get(item.id) ?? 0;
            const group = groupByClass.get(item.id);
            return (
              <article key={item.id} className={cn(adminSurfaceClass, "p-5 transition motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-md")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-[.12em] text-neutral-500">{item.class_level} · {item.stream}</span>
                    <h2 className="mt-2 font-display text-lg font-extrabold text-neutral-950">{item.name}</h2>
                    <p className="mt-1 text-xs text-neutral-500">{item.room || "Room not assigned"}</p>
                  </div>
                  <Button size="icon" variant="outline" render={<Link href={`/admin/classes?modal=class&class=${encodeURIComponent(item.id)}`} />} className={adminIconButtonClass} aria-label={`Manage ${item.name}`}><MoreHorizontal className="size-5" /></Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-neutral-50 p-3"><span className="text-xs text-neutral-500">Students</span><strong className="mt-1 block text-neutral-950">{count}/{item.capacity}</strong></div>
                  <div className="rounded-xl bg-neutral-50 p-3"><span className="text-xs text-neutral-500">WhatsApp</span><strong className="mt-1 block text-sm text-neutral-950">{group ? "Connected" : "Not set"}</strong></div>
                </div>
                {group ? (
                  scope.isAdmin ? (
                    <Button render={<Link href={`/admin/classes?modal=whatsapp-edit&class=${encodeURIComponent(item.id)}&group=${encodeURIComponent(group.id)}`} />} variant="outline" className="mt-4 min-h-11 w-full justify-start rounded-xl border-neutral-200 bg-white px-3 text-left text-xs font-semibold text-neutral-900 hover:bg-neutral-50"><QrCode className="size-4" />{group.name}</Button>
                  ) : (
                    <Button render={<a href={group.invite_url} target="_blank" rel="noreferrer" />} variant="outline" className="mt-4 min-h-11 w-full justify-start rounded-xl border-neutral-200 bg-white px-3 text-left text-xs font-semibold text-neutral-900 hover:bg-neutral-50"><QrCode className="size-4" />{group.name}</Button>
                  )
                ) : scope.isAdmin ? (
                  <Button render={<Link href={`/admin/classes?modal=whatsapp-new&class=${encodeURIComponent(item.id)}`} />} variant="outline" className="mt-4 min-h-11 w-full justify-start rounded-xl border-neutral-200 bg-white px-3 text-xs font-semibold"><MessageCircle className="size-4" />Add WhatsApp group</Button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <section className={adminSurfaceClass}><AdminEmptyState title="No classes configured" description="Create the academic structure before assigning students." action={scope.isAdmin ? <Button render={<Link href="/admin/classes?modal=class-new" />} className={adminPrimaryButtonClass}><School className="size-4" />New class</Button> : undefined} /></section>
      )}

      <section className={cn(adminSurfaceClass, "mt-6 overflow-hidden")}>
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-5">
          <div><p className="text-xs font-bold uppercase tracking-[.12em] text-neutral-500">WhatsApp group management</p><h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Class group QR board</h2></div>
          {scope.isAdmin ? <Button render={<Link href="/admin/classes?modal=whatsapp-new" />} variant="outline" className={adminSecondaryButtonClass}><Plus className="size-4" />Add group</Button> : null}
        </div>
        {groups.length ? <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-[.1em] text-neutral-500"><tr><th className="px-4 py-3">Group</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead>
              <tbody className="divide-y divide-neutral-100">{groups.map((group) => {
                const cls = classById.get(group.class_id);
                return <tr key={group.id} className="hover:bg-neutral-50"><td className="px-4 py-3"><strong>{group.name}</strong></td><td className="px-4 py-3">{cls?.name ?? "Unassigned"}</td><td className="px-4 py-3 text-xs text-neutral-500">{formatUpdated(group.updated_at)}</td><td className="px-4 py-3 text-right">{scope.isAdmin ? <Button size="icon" variant="outline" render={<Link href={`/admin/classes?modal=whatsapp-edit&class=${encodeURIComponent(group.class_id)}&group=${encodeURIComponent(group.id)}`} />} className={adminIconButtonClass} aria-label={`Manage ${group.name}`}><QrCode className="size-4" /></Button> : <Button size="icon" variant="outline" render={<a href={group.invite_url} target="_blank" rel="noreferrer" />} className={adminIconButtonClass} aria-label={`Open ${group.name}`}><QrCode className="size-4" /></Button>}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="divide-y divide-neutral-100 md:hidden">{groups.map((group) => scope.isAdmin ? <Link key={group.id} href={`/admin/classes?modal=whatsapp-edit&class=${encodeURIComponent(group.class_id)}&group=${encodeURIComponent(group.id)}`} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50"><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{group.name}</strong><span className="text-xs text-neutral-500">{classById.get(group.class_id)?.name ?? "Unassigned"}</span></span><QrCode className="size-4 text-neutral-500" /></Link> : <a key={group.id} href={group.invite_url} target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50"><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{group.name}</strong><span className="text-xs text-neutral-500">{classById.get(group.class_id)?.name ?? "Unassigned"}</span></span><QrCode className="size-4 text-neutral-500" /></a>)}</div>
        </> : <AdminEmptyState title="No WhatsApp groups yet" description="Add a group invite link and associate it with a class. Festacol will keep the class communication relationship in production storage." />}
      </section>
    </div>
  );
}
