import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  return (
    <main className="min-h-dvh bg-background p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col justify-between bg-primary p-7 text-primary-foreground sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-foreground text-sm font-black text-primary">F</span>
            <div>
              <strong className="block font-display text-sm font-extrabold">Festacol</strong>
              <span className="text-xs text-primary-foreground/60">Academic operations</span>
            </div>
          </div>

          <div className="py-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary-foreground/45">Administration</p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">Admin sign in</h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-primary-foreground/65">Supabase-managed administrator account (email + password).</p>
          </div>

          <span className="text-xs text-primary-foreground/45">Assessment operations · student records · integrity review</span>
        </section>

        <section className="flex items-center p-7 sm:p-11">
          <Card className="mx-auto w-full max-w-xl border-0 bg-transparent py-0 shadow-none">
            <CardHeader className="px-0">
              <Badge className="mb-2">Staff authentication</Badge>
              <CardTitle className="font-display text-3xl font-extrabold">Admin sign in</CardTitle>
              <CardDescription className="mt-2 text-base leading-7">Supabase-managed administrator account (email + password).</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-3">
              <AdminLoginForm next={next} />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
