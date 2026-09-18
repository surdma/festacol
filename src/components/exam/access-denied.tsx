"use client";

import { AlertTriangle, BookOpenCheck, Clock, Lock, ShieldX } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ExamAccessDeniedProps {
  title: string;
  message: string;
  reason?: string;
  signInHref?: string;
  signInLabel?: string;
  returnHref?: string;
  token?: string;
}

export function ExamAccessDenied({
  title,
  message,
  reason,
  signInHref,
  signInLabel,
  returnHref,
}: ExamAccessDeniedProps) {
  const icons = {
    expired: Clock,
    ended: Lock,
    not_open: Lock,
    not_eligible: ShieldX,
    not_qualified: AlertTriangle,
    placement_first: BookOpenCheck,
    default: AlertTriangle,
  };
  const IconComponent = icons[reason as keyof typeof icons] ?? icons.default;

  return (
    <Card className="mx-auto max-w-md border-0 bg-transparent shadow-none">
      <CardHeader className="gap-4 px-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Examination access</p>
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
          <IconComponent className="size-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="grid gap-1">
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{message}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-1 pt-2">
        {signInHref ? (
          <Link
            href={signInHref}
            className={cn(buttonVariants({ size: "lg" }), "min-h-12 w-full")}
            aria-label={signInLabel || "Continue"}
          >
            {signInLabel || "Continue"}
          </Link>
        ) : null}
        {returnHref ? (
          <Link
            href={returnHref}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-12 w-full")}
          >
            Back to exam
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
