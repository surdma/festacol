import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ExamIdDialog } from "@/components/exam-id-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentStudent } from "@/lib/auth/current-student";
import { attemptsForStudent } from "@/lib/supabase/queries";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "in-progress", label: "In progress" },
] as const;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await currentStudent();
  if (!ctx) redirect("/?next=/dashboard/history");
  const rawStatus = (await searchParams).status;
  const status =
    rawStatus === "submitted" || rawStatus === "in-progress"
      ? rawStatus
      : "all";
  const attempts = await attemptsForStudent(
    ctx.supabase,
    ctx.profile.profile_id,
  );
  const visible =
    status === "all"
      ? attempts
      : attempts.filter((attempt) =>
          status === "submitted" ? attempt.submitted_at : !attempt.submitted_at,
        );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Exam history</h1>
        <p className="text-muted-foreground">
          Every attempt on your record — submitted and in progress.
        </p>
      </div>
      <nav aria-label="Filter attempts by status" className="flex gap-2">
        {FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <Button
              key={filter.value}
              size="sm"
              variant={active ? "default" : "outline"}
              render={
                <Link
                  href={
                    filter.value === "all"
                      ? "/dashboard/history"
                      : `/dashboard/history?status=${filter.value}`
                  }
                  aria-current={active ? "page" : undefined}
                />
              }
            >
              {filter.label}
            </Button>
          );
        })}
      </nav>
      {visible.length ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Integrity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>
                      {attempt.context_snapshot.sessionTitle}
                    </TableCell>
                    <TableCell>#{attempt.attempt_number}</TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={attempt.submitted_at ? "emerald" : "amber"}
                      >
                        {attempt.submitted_at ? "Submitted" : "In progress"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {attempt.submitted_at ? `${attempt.score ?? "—"}%` : "—"}
                    </TableCell>
                    <TableCell>
                      {attempt.submitted_at
                        ? `${attempt.integrity_score ?? "—"}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title={
            status === "all" ? "No exam attempts yet" : "Nothing here yet"
          }
          description={
            status === "all"
              ? "Open an exam from a link, QR card, or the Exam ID button."
              : `No ${status === "submitted" ? "submitted" : "in-progress"} attempts match this filter.`
          }
        />
      )}
      <ExamIdDialog />
    </div>
  );
}
