import Link from "next/link";
import { signOutSessionAction } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeStaffDestination, safeStudentDestination } from "@/lib/auth/navigation";

function SwitchForm({ surface, next, label }: { surface: "student" | "staff"; next?: string; label: string }) {
  return (
    <form action={signOutSessionAction}>
      <input type="hidden" name="surface" value={surface} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Button type="submit" className="w-full" variant={surface === "student" ? "default" : "outline"}>
        {label}
      </Button>
    </form>
  );
}

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason;
  const studentNext = safeStudentDestination(params.from);
  const staffNext = safeStaffDestination(params.from);

  const title =
    reason === "staff-on-student"
      ? "Staff accounts cannot open the student portal"
      : reason === "student-on-staff"
        ? "Student accounts cannot open administration"
        : "Permission denied";

  const message =
    reason === "staff-on-student"
      ? "You are signed in with a staff account. End that session before continuing with a student account."
      : reason === "student-on-staff"
        ? "You are signed in with a student account. End that session before continuing with a staff account."
        : "Your current account does not have permission to view the page you just left. Switch accounts or return to the portal you are already signed into.";

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {reason === "staff-on-student" ? (
            <>
              <SwitchForm surface="student" next={studentNext} label="Sign out and continue as student" />
              <Link href="/workspace" className={buttonVariants({ variant: "ghost", className: "w-full" })}>Return to staff workspace</Link>
            </>
          ) : reason === "student-on-staff" ? (
            <>
              <SwitchForm surface="staff" next={staffNext} label="Sign out and continue as staff" />
              <Link href="/dashboard" className={buttonVariants({ variant: "ghost", className: "w-full" })}>Return to student dashboard</Link>
            </>
          ) : (
            <>
              <SwitchForm surface="student" next={studentNext} label="Switch to student account" />
              <SwitchForm surface="staff" next={staffNext} label="Switch to staff account" />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
