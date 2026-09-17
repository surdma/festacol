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

function switchTarget(signInHref: string) {
  if (signInHref === "/workspace/login" || signInHref === "/workspace" || signInHref.startsWith("/workspace/")) {
    return { surface: "staff" as const, next: safeStaffDestination(signInHref) };
  }

  return { surface: "student" as const, next: safeStudentDestination(signInHref) };
}

export function AccessDenied({
  title,
  message,
  signInHref,
  signInLabel,
  returnHref,
}: {
  title: string;
  message: string;
  signInHref: string;
  signInLabel: string;
  returnHref?: string;
}) {
  const target = switchTarget(signInHref);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <form action={signOutSessionAction}>
          <input type="hidden" name="surface" value={target.surface} />
          {target.next ? <input type="hidden" name="next" value={target.next} /> : null}
          <Button type="submit" className="w-full">
            Sign out and switch account
          </Button>
        </form>
        <p className="px-1 text-xs text-muted-foreground">{signInLabel} after the current session is cleared.</p>
        {returnHref ? (
          <Link href={returnHref} className={buttonVariants({ variant: "ghost", className: "w-full" })}>
            Back to previous page
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
