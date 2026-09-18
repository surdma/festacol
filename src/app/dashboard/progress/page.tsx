import { ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentStudent } from "@/lib/auth/current-student";
import { SCIENCE_PLACEMENT_THRESHOLD } from "@/lib/student-placement";
import { attemptsForStudent } from "@/lib/supabase/queries";

function studentTrackLabel(value: string | null | undefined): string {
  if (value === "science") return "Science";
  if (value === "humanities") return "Art";
  if (value === "business") return "Commercial";
  return "Not selected";
}

export default async function ProgressPage() {
  const ctx = await currentStudent();
  if (!ctx) redirect("/?next=/dashboard/progress");

  const attempts = await attemptsForStudent(
    ctx.supabase,
    ctx.profile.profile_id,
  );
  const qualifier = attempts.find(
    (attempt) =>
      attempt.submitted_at && attempt.context_snapshot.mode === "qualifier",
  );

  const score = qualifier?.score == null ? null : Math.max(0, Number(qualifier.score));
  const scienceEligible = score !== null && score > SCIENCE_PLACEMENT_THRESHOLD;
  const classRow = ctx.classRow as
    | { id?: string; level_id?: string; track?: string; arm?: string }
    | null;
  let levelName = "";

  if (classRow?.level_id) {
    const { data: level } = await ctx.supabase
      .from("academic_levels")
      .select("name")
      .eq("id", classRow.level_id)
      .maybeSingle();
    levelName = String((level as { name?: string } | null)?.name ?? "");
  }

  const selectedTrack = classRow?.track ?? null;
  const selectedClass = classRow
    ? `${levelName || "SS1"} ${studentTrackLabel(selectedTrack)} · Arm ${classRow.arm ?? ""}`.trim()
    : null;

  return (
    <div className="grid gap-4">
      <div>
        <Badge variant="outline">
          <GraduationCap className="size-3.5" aria-hidden="true" />
          Placement record
        </Badge>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          Progress & promotion
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Academic session</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Student: {ctx.profile.full_name} ·{" "}
            {attempts.filter((attempt) => attempt.submitted_at).length} exams
            completed
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SS1 placement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {qualifier ? (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">
                    Placement score
                  </p>
                  <p className="mt-1 text-3xl font-black tabular-nums">
                    {Math.round(score ?? 0)}%
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {scienceEligible
                      ? `Above ${SCIENCE_PLACEMENT_THRESHOLD}% — Science qualified.`
                      : `${SCIENCE_PLACEMENT_THRESHOLD}% or below — choose Art or Commercial.`}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">
                    Current class
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {selectedClass ?? "Class choice still required"}
                  </p>
                  {scienceEligible && selectedTrack && selectedTrack !== "science" ? (
                    <p className="mt-1 text-muted-foreground">
                      You qualified for Science and chose {studentTrackLabel(selectedTrack)}.
                    </p>
                  ) : null}
                </div>

                <Link
                  href={`/dashboard/history/result/${encodeURIComponent(qualifier.id)}`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  {selectedClass ? "Review placement result" : "Choose your class"}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">
                Pending — complete the SS1 placement examination first.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
