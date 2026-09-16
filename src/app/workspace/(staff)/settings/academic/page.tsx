import { BookOpenCheck, CalendarDays, Database, School } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubjectsManager } from "@/app/workspace/(staff)/settings/subjects-manager";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentStaff } from "@/lib/auth/staff";

const TRACKS = ["science", "humanities", "business"] as const;

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

export default async function AcademicSettingsPage() {
  const { supabase, scope } = await currentStaff();
  if (!scope.isAdmin) redirect("/workspace/settings");

  const [{ data: years }, { data: terms }, { data: levels }, { data: subjects }, { data: curriculumRules }] = await Promise.all([
    supabase.from("academic_years").select("id,name,starts_on,ends_on,status").order("starts_on", { ascending: false }),
    supabase.from("academic_terms").select("id,academic_year_id,name,sequence,starts_on,ends_on,status").order("sequence"),
    supabase.from("academic_levels").select("id,name,ordinal,active").order("ordinal"),
    supabase.from("subjects").select("id,name,active").order("name"),
    supabase.from("subject_curriculum_rules").select("subject_id,level_id,track,participation"),
  ]);

  const yearRows = (years ?? []) as { id: string; name: string; starts_on: string | null; ends_on: string | null; status: string }[];
  const termRows = (terms ?? []) as { id: string; academic_year_id: string; name: string; sequence: number; starts_on: string | null; ends_on: string | null; status: string }[];
  const levelRows = (levels ?? []) as { id: string; name: string; ordinal: number; active: boolean }[];
  const subjectRows = (subjects ?? []) as { id: string; name: string; active: boolean }[];
  const ruleRows = (curriculumRules ?? []) as { subject_id: string; level_id: string; track: string; participation: string }[];
  const activeYear = yearRows.find((year) => year.status === "active") ?? null;
  const activeTerms = activeYear ? termRows.filter((term) => term.academic_year_id === activeYear.id) : [];
  const activeTerm = activeTerms.find((term) => term.status === "active") ?? null;
  const activeLevels = levelRows.filter((level) => level.active);
  const activeSubjects = subjectRows.filter((subject) => subject.active);

  const curriculumSummary = activeLevels.flatMap((level) =>
    TRACKS.map((track) => {
      const matching = ruleRows.filter((rule) => rule.level_id === level.id && rule.track === track);
      return {
        key: `${level.id}:${track}`,
        level: level.name,
        track,
        required: matching.filter((rule) => rule.participation === "required").length,
        elective: matching.filter((rule) => rule.participation === "elective").length,
        total: matching.length,
      };
    }),
  );

  return (
    <div>
      <AdminPageHeader
        eyebrow="Academic structure"
        title="Calendar & curriculum"
        description="Inspect the persisted academic year, terms, levels, subjects and curriculum-rule matrix used by classes and examinations."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/workspace/data-library" className={buttonVariants({ variant: "outline" })}>
              <Database data-icon="inline-start" />
              School data
            </Link>
            <Link href="/workspace/classes" className={buttonVariants()}>
              <School data-icon="inline-start" />
              Open classes
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid border-y border-border bg-muted/20 sm:grid-cols-4">
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Academic year</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{activeYear?.name ?? "Not active"}</p>
        </div>
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Current term</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{activeTerm?.name ?? "Not active"}</p>
        </div>
        <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Senior levels</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{activeLevels.map((level) => level.name).join(" · ") || "None"}</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Subjects</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{activeSubjects.length} active</p>
        </div>
      </div>

      <section id="calendar" aria-labelledby="calendar-heading" className="scroll-mt-24">
        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">School calendar</p>
            <h2 id="calendar-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">Academic years & terms</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">The active year and term are consumed by class and examination workflows. The prepared class fixture is the current source for calendar provisioning.</p>
          </div>
          <Badge variant={activeYear && activeTerm ? "secondary" : "destructive"}>{activeYear && activeTerm ? "Calendar active" : "Needs attention"}</Badge>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {yearRows.length ? yearRows.map((year) => {
            const yearTerms = termRows.filter((term) => term.academic_year_id === year.id);
            return (
              <div key={year.id} className="grid gap-4 px-1 py-5 sm:grid-cols-[minmax(0,.8fr)_minmax(0,1.7fr)] sm:px-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-semibold text-foreground">{year.name}</strong>
                    <Badge variant={year.status === "active" ? "secondary" : "outline"}>{titleCase(year.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{year.starts_on ?? "Start date not set"} → {year.ends_on ?? "End date not set"}</p>
                </div>
                <div className="divide-y divide-border border-y border-border sm:border-y-0">
                  {yearTerms.length ? yearTerms.map((term) => (
                    <div key={term.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{term.sequence}. {term.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{term.starts_on ?? "Start date not set"} → {term.ends_on ?? "End date not set"}</p>
                      </div>
                      <Badge variant={term.status === "active" ? "secondary" : "outline"}>{titleCase(term.status)}</Badge>
                    </div>
                  )) : <p className="py-3 text-sm text-muted-foreground">No terms configured for this year.</p>}
                </div>
              </div>
            );
          }) : <p className="px-3 py-8 text-sm text-muted-foreground">No academic years have been prepared.</p>}
        </div>
      </section>

      <section id="curriculum" aria-labelledby="curriculum-heading" className="mt-9 scroll-mt-24">
        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Curriculum relationships</p>
            <h2 id="curriculum-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">Level × track rule matrix</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">These rows summarize `subject_curriculum_rules`. Required and elective participation controls which subjects can become concrete class offerings.</p>
          </div>
          <Badge variant="outline">{ruleRows.length} rules</Badge>
        </div>

        <div className="border-y border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Study track</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">Elective</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {curriculumSummary.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.level}</TableCell>
                  <TableCell>{titleCase(row.track)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.required}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.elective}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Alert className="mt-4">
          <BookOpenCheck />
          <AlertTitle>Curriculum rules are fixture-managed</AlertTitle>
          <AlertDescription>
            Use <Link href="/workspace/data-library">School Data</Link> to reload the approved subject curriculum. Class-specific offerings remain managed from Classes.
          </AlertDescription>
        </Alert>
      </section>

      <div className="mt-9">
        <SubjectsManager initial={subjectRows} />
      </div>

      <Alert className="mt-6">
        <CalendarDays />
        <AlertTitle>Class offerings are configured separately</AlertTitle>
        <AlertDescription>
          Classes combine the active academic year, senior level and study track with concrete subject offerings. Keep that workflow in <Link href="/workspace/classes">Classes</Link> to avoid duplicate settings state.
        </AlertDescription>
      </Alert>
    </div>
  );
}
