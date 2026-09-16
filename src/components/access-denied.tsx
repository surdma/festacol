"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOutStudentAction } from "@/app/actions/student";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchAccount() {
    startTransition(async () => {
      await signOutStudentAction();
      router.push(signInHref);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button onClick={switchAccount} disabled={pending}>
          {pending ? "Signing out…" : "Sign out and switch account"}
        </Button>
        <Button variant="outline" render={<Link href={signInHref} />}>
          {signInLabel}
        </Button>
        {returnHref ? (
          <Button variant="ghost" render={<Link href={returnHref} />}>
            Back to previous page
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
