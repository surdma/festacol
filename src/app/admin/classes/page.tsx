import Link from "next/link";
import { listClasses } from "@/lib/supabase/queries";
import { currentStaff } from "@/lib/auth/staff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeUp } from "@/components/motion";
import { DeleteButtons } from "@/components/admin/entity-forms";

export default async function AdminClassesPage() {
  const { supabase, scope } = await currentStaff();
  const classes = await listClasses(supabase);
  const { data: groups } = await supabase.from("whatsapp_groups").select("*").limit(200);
  const byClass = new Map<string, { id: string; name: string }[]>();
  for (const g of ((groups ?? []) as { id: string; class_id: string; name: string }[])) {
    byClass.set(g.class_id, [...(byClass.get(g.class_id) ?? []), { id: g.id, name: g.name }]);
  }
  return (
    <FadeUp className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Classes</h1><p className="text-muted-foreground">Route: /admin/classes — WhatsApp board included</p></div>
        {scope.isAdmin ? <Button render={<Link href="/admin/classes?modal=class-new" />}>Add class</Button> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => (
          <Card key={c.id}>
            <CardHeader><CardTitle>{c.name}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>{c.class_level} · {c.stream} · cap {c.capacity}{c.room ? ` · ${c.room}` : ""}</p>
              {(byClass.get(c.id) ?? []).map((g) => (
                <p key={g.id} className="flex items-center justify-between gap-2">
                  <span>{g.name}</span>{scope.isAdmin ? <DeleteButtons kind="whatsapp" id={g.id} /> : null}
                </p>
              ))}
              {scope.isAdmin ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" render={<Link href={`/admin/classes?modal=whatsapp-new&class=${c.id}`} />}>Add WhatsApp</Button>
                  <DeleteButtons kind="class" id={c.id} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {classes.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No classes. Seed via Supabase SQL (prototype/supabase/seed_classes.sql).</CardContent></Card> : null}
      </div>
    </FadeUp>
  );
}
