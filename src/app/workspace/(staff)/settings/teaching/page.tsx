import { BriefcaseBusiness, GraduationCap } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { MajorPicker } from "@/components/admin/major-picker";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { currentStaff } from "@/lib/auth/staff";

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function TeachingSettingsPage() {
  const { supabase, scope } = await currentStaff();
  if (!scope.isTeacher || !scope.profileId) redirect("/workspace/settings");

  const { data: assignmentRows } = await supabase
    .from("teaching_assignments")
    .select("id,offering_id,assignment_role,assigned_at")
    .eq("staff_id", scope.profileId)
    .is("ended_at", null)
    .order("assigned_at", { ascending: true });

  const assignments = (assignmentRows ?? []) as {
    id: string;
    offering_id: string;
    assignment_role: string;
    assigned_at: string;
  }[];
  const offeringIds = assignments.map((assignment) => assignment.offering_id);

  const { data: offeringRows } = offeringIds.length
    ? await supabase
        .from("class_subject_offerings")
        .select("id,class_id,subject_id,status")
        .in("id", offeringIds)
    : { data: [] };
  const offerings = (offeringRows ?? []) as {
    id: string;
    class_id: string;
    subject_id: string;
    status: string;
  }[];

  const classIds = [...new Set(offerings.map((offering) => offering.class_id))];
  const subjectIds = [...new Set(offerings.map((offering) => offering.subject_id))];
  const [{ data: classRows }, { data: subjectRows }] = await Promise.all([
    classIds.length
      ? supabase
          .from("classes")
          .select("id,level_id,track,academic_year_id,arm,status")
          .in("id", classIds)
      : Promise.resolve({ data: [] }),
    subjectIds.length
      ? supabase.from("subjects").select("id,name,code").in("id", subjectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const classes = (classRows ?? []) as {
    id: string;
    level_id: string;
    track: string;
    academic_year_id: string;
    arm: string;
    status: string;
  }[];
  const subjects = (subjectRows ?? []) as { id: string; name: string; code: string }[];
  const levelIds = [...new Set(classes.map((row) => row.level_id))];
  const yearIds = [...new Set(classes.map((row) => row.academic_year_id))];
  const [{ data: levelRows }, { data: yearRows }] = await Promise.all([
    levelIds.length
      ? supabase.from("academic_levels").select("id,name").in("id", levelIds)
      : Promise.resolve({ data: [] }),
    yearIds.length
      ? supabase.from("academic_years").select("id,name").in("id", yearIds)
      : Promise.resolve({ data: [] }),
  ]);

  const offeringById = new Map(offerings.map((row) => [row.id, row]));
  const classById = new Map(classes.map((row) => [row.id, row]));
  const subjectById = new Map(subjects.map((row) => [row.id, row]));
  const levelById = new Map(((levelRows ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const yearById = new Map(((yearRows ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));

  const assignmentDetails = assignments.flatMap((assignment) => {
    const offering = offeringById.get(assignment.offering_id);
    if (!offering) return [];
    const classRow = classById.get(offering.class_id);
    const subject = subjectById.get(offering.subject_id);
    if (!classRow || !subject) return [];

    return [{
      id: assignment.id,
      role: titleCase(assignment.assignment_role),
      subject: subject.name,
      subjectCode: subject.code,
      classLabel: `${levelById.get(classRow.level_id) ?? "Level"} ${classRow.arm}`,
      track: titleCase(classRow.track),
      year: yearById.get(classRow.academic_year_id) ?? "Academic year",
      offeringStatus: offering.status,
    }];
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Teaching scope"
        title="Qualifications & assignments"
        description="Your qualifications control subject-level access. Your assignments show the exact class-subject offerings school administration has attached to you."
      />

      <div className="mb-7 flex flex-wrap items-center gap-2 border-y border-border bg-muted/20 px-3 py-3">
        <Badge variant="outline">Teacher</Badge>
        <Badge variant="secondary">{scope.subjectIds.length} qualified subjects</Badge>
        <Badge variant="secondary">{assignmentDetails.length} active assignments</Badge>
        <Badge variant="secondary">Placement & entrance always available</Badge>
      </div>

      <MajorPicker />

      <section id="assignments" aria-labelledby="assignments-heading" className="mt-8 scroll-mt-24">
        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Administrator-managed</p>
            <h2 id="assignments-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">Current teaching assignments</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Assignments connect you to a concrete class-subject offering. Change requests must be handled by an administrator.</p>
          </div>
          <Badge variant="outline">Read only</Badge>
        </div>

        {assignmentDetails.length ? (
          <div className="divide-y divide-border border-y border-border">
            {assignmentDetails.map((assignment) => (
              <div key={assignment.id} className="grid gap-3 px-1 py-4 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] sm:items-center sm:px-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
                    <GraduationCap className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-foreground">{assignment.subject}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">{assignment.subjectCode.toUpperCase()} · {assignment.role}</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{assignment.classLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{assignment.track} · {assignment.year}</p>
                </div>
                <Badge variant={assignment.offeringStatus === "active" ? "secondary" : "outline"}>{titleCase(assignment.offeringStatus)}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <Empty className="min-h-52 border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><BriefcaseBusiness /></EmptyMedia>
              <EmptyTitle>No active teaching assignments</EmptyTitle>
              <EmptyDescription>Your qualifications may be configured, but no class-subject offering is currently assigned to you.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  );
}
