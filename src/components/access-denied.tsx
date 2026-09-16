"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOutStudentAction } from "@/app/actions/student";
import { Button, buttonVariants } from "@/components/ui/button";
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
        <Link href={signInHref} className={buttonVariants({ variant: "outline" })}>
          {signInLabel}
        </Link>
        {returnHref ? (
          <Link href={returnHref} className={buttonVariants({ variant: "ghost" })}>
            Back to previous page
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
