import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function safeReturn(href: string | undefined): string | undefined {
  if (href && href.startsWith("/") && !href.startsWith("//")) return href;
  return undefined;
}

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const from = safeReturn(params.from);
  const reason = params.reason;

  const title =
    reason === "staff-on-student"
      ? "Staff accounts cannot open the student portal"
      : reason === "student-on-staff"
        ? "Student accounts cannot open administration"
        : "Permission denied";

  const message =
    reason === "staff-on-student"
      ? "You are signed in with a staff account. Sign out first, then sign in with a student account to continue."
      : reason === "student-on-staff"
        ? "You are signed in with a student account. Sign out first, then sign in with a staff account to continue."
        : "Your current account does not have permission to view the page you just left. Sign out to switch accounts, or return to sign in.";

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button render={<Link href="/" />}>Go to student sign in</Button>
          <Button variant="outline" render={<Link href="/workspace/login" />}>
            Go to staff sign in
          </Button>
          {from ? (
            <Button variant="ghost" render={<Link href={from} />}>
              Back to previous page
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
