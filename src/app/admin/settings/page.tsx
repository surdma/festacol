import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Database,
  GraduationCap,
  KeyRound,
  School,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { currentStaff } from "@/lib/auth/staff";

interface SettingActionRowProps {
  href: string;
  title: string;
  description: string;
  status: string;
  action: string;
  icon: typeof School;
  tone?: "default" | "attention";
}

function SettingActionRow({ href, title, description, status, action, icon: Icon, tone = "default" }: SettingActionRowProps) {
  return (
    <Link
      href={href}
      className="group grid gap-3 px-1 py-5 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 sm:grid-cols-[2.25rem_minmax(0,1fr)_minmax(9rem,.55fr)_auto] sm:items-center sm:px-3"
    >
      <span className="grid size-9 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-semibold text-foreground">{title}</strong>
        <span className="mt-1 block max-w-2xl text-sm leading-5 text-muted-foreground">{description}</span>
      </span>
      <span className="sm:text-right">
        <Badge variant={tone === "attention" ? "destructive" : "secondary"}>{status}</Badge>
      </span>
      <span className="flex items-center gap-1 text-xs font-semibold text-foreground sm:justify-end">
        {action}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function StatusStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="mb-7 flex flex-wrap items-stretch border-y border-border bg-muted/20">
      {items.map((item, index) => (
        <div key={item.label} className="min-w-[150px] flex-1 px-4 py-4 sm:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{item.label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{item.value}</p>
          {index < items.length - 1 ? <Separator orientation="vertical" className="sr-only" /> : null}
        </div>
      ))}
    </div>
  );
}

export default async function AdminSettingsPage() {
  const { supabase, scope } = await currentStaff();

  const { data: memberRow } = scope.profileId
    ? await supabase
        .from("school_members")
        .select("first_name,last_name,staff_number,qualifier_access")
        .eq("id", scope.profileId)
        .maybeSingle()
    : { data: null };
  const member = memberRow as {
    first_name: string;
    last_name: string;
    staff_number: string | null;
    qualifier_access: boolean;
  } | null;

  if (!scope.isAdmin) {
    const [{ data: subjectRows }, { count: assignmentCount }] = await Promise.all([
      scope.subjectIds.length
        ? supabase.from("subjects").select("id,name").in("id", scope.subjectIds).eq("active", true).order("name")
        : Promise.resolve({ data: [] }),
      scope.profileId
        ? supabase
            .from("teaching_assignments")
            .select("id", { count: "exact", head: true })
            .eq("staff_id", scope.profileId)
            .is("ended_at", null)
        : Promise.resolve({ count: 0 }),
    ]);
    const subjects = (subjectRows ?? []) as { id: string; name: string }[];
    const teacherName = member ? `${member.first_name} ${member.last_name}` : "Teacher";

    return (
      <div>
        <AdminPageHeader
          eyebrow="My settings"
          title="Teaching configuration"
          description="Your settings are limited to your own teaching scope and staff account. School-wide curriculum, classes, fixture loading and maintenance stay administrator-only."
        />

        <div className="mb-7 flex flex-col gap-3 border-l-2 border-foreground pl-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Signed in as {teacherName}</p>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight text-foreground">What you can configure</h2>
          </div>
          <Badge variant="outline">Teacher workspace</Badge>
        </div>

        <StatusStrip
          items={[
            { label: "Qualified subjects", value: `${subjects.length}` },
            { label: "Active assignments", value: `${assignmentCount ?? 0}` },
            { label: "Qualifier access", value: scope.qualifierAccess ? "Enabled" : "Not assigned" },
          ]}
        />

        <section aria-labelledby="teacher-settings-heading">
          <div className="flex items-end justify-between gap-4 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Configuration</p>
              <h2 id="teacher-settings-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">Teaching and account controls</h2>
            </div>
          </div>
          <div className="divide-y divide-border border-y border-border">
            <SettingActionRow
              href="/admin/settings/teaching"
              title="Subject qualifications"
              description="Choose the subjects you are qualified to teach and use in your question-bank workspace."
              status={subjects.length ? `${subjects.length} selected` : "Needs setup"}
              action="Configure"
              icon={BookOpenCheck}
              tone={subjects.length ? "default" : "attention"}
            />
            <SettingActionRow
              href="/admin/settings/teaching#assignments"
              title="Teaching assignments"
              description="Review the actual class-and-subject offerings assigned to you by school administration."
              status={`${assignmentCount ?? 0} active`}
              action="Review"
              icon={GraduationCap}
            />
            <SettingActionRow
              href="/admin/settings/account"
              title="Account & access"
              description="Review your staff identity, role, sign-in email and qualifier-exam permission."
              status={member?.staff_number ?? "No staff number"}
              action="Open"
              icon={ShieldCheck}
              tone={member?.staff_number ? "default" : "attention"}
            />
          </div>
        </section>
      </div>
    );
  }

  const { data: activeYearRow } = await supabase
    .from("academic_years")
    .select("id,name,status")
    .eq("status", "active")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeYear = activeYearRow as { id: string; name: string; status: string } | null;

  const [
    { data: activeTermRow },
    { count: subjectCount },
    { count: curriculumRuleCount },
    { count: classCount },
    { count: offeringCount },
    { count: assignmentCount },
    { count: questionCount },
  ] = await Promise.all([
    activeYear
      ? supabase
          .from("academic_terms")
          .select("id,name,status")
          .eq("academic_year_id", activeYear.id)
          .eq("status", "active")
          .order("sequence")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("subject_curriculum_rules").select("subject_id", { count: "exact", head: true }),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("class_subject_offerings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("teaching_assignments").select("id", { count: "exact", head: true }).is("ended_at", null),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const activeTerm = activeTermRow as { id: string; name: string; status: string } | null;

  return (
    <div>
      <AdminPageHeader
        eyebrow="School settings"
        title="Configuration"
        description="Operate the persisted school configuration used by classes, teaching assignments, examinations and the approved data fixtures. Each row below maps to a real application relation or administrative workspace."
      />

      <div className="mb-7 flex flex-col gap-3 border-l-2 border-foreground pl-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Administrator control plane</p>
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight text-foreground">School configuration health</h2>
        </div>
        <Badge variant="outline">Administrator</Badge>
      </div>

      <StatusStrip
        items={[
          { label: "Academic year", value: activeYear?.name ?? "Not active" },
          { label: "Active term", value: activeTerm?.name ?? "Not active" },
          { label: "Curriculum", value: `${subjectCount ?? 0} subjects · ${curriculumRuleCount ?? 0} rules` },
        ]}
      />

      <section aria-labelledby="school-settings-heading">
        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">School configuration</p>
            <h2 id="school-settings-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">Operational settings</h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">Configuration is split by authoritative domain so classes, staff and fixtures are never edited through duplicate settings controls.</p>
        </div>

        <div className="divide-y divide-border border-y border-border">
          <SettingActionRow
            href="/admin/settings/academic#calendar"
            title="Academic calendar"
            description="Review the active academic year and term sequence used when classes and examinations are created."
            status={activeYear && activeTerm ? `${activeYear.name} · ${activeTerm.name}` : "Needs attention"}
            action="Configure"
            icon={CalendarDays}
            tone={activeYear && activeTerm ? "default" : "attention"}
          />
          <SettingActionRow
            href="/admin/settings/academic#curriculum"
            title="Curriculum & subjects"
            description="Manage the subject catalogue and inspect level-by-track curriculum participation rules."
            status={`${subjectCount ?? 0} subjects · ${curriculumRuleCount ?? 0} rules`}
            action="Manage"
            icon={BookOpenCheck}
          />
          <SettingActionRow
            href="/admin/classes"
            title="Classes & subject offerings"
            description="Manage class arms and the concrete subjects offered by each class for the active academic year."
            status={`${classCount ?? 0} classes · ${offeringCount ?? 0} offerings`}
            action="Open classes"
            icon={School}
          />
          <SettingActionRow
            href="/admin/staff"
            title="Staff teaching scope"
            description="Manage staff qualifications and the class-subject offerings assigned to individual teachers."
            status={`${assignmentCount ?? 0} active assignments`}
            action="Manage staff"
            icon={UsersRound}
          />
          <SettingActionRow
            href="/admin/data-library"
            title="School data fixtures"
            description="Inspect schema versions, dependency order and load state for the approved JSON fixture sources."
            status={`${questionCount ?? 0} active questions`}
            action="Open operations"
            icon={Database}
          />
          <SettingActionRow
            href="/admin/settings/account"
            title="Administrator account"
            description="Review the current staff identity, administrator role and authenticated sign-in account."
            status={member?.staff_number ?? "No staff number"}
            action="Review access"
            icon={KeyRound}
            tone={member?.staff_number ? "default" : "attention"}
          />
        </div>
      </section>
    </div>
  );
}
