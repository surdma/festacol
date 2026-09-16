"use client";

import Link from "next/link";
import { useTransition } from "react";
import { signOutStudentAction } from "@/app/actions/student";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Lock, ShieldX, AlertTriangle, BookOpenCheck } from "lucide-react";

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
  token,
}: ExamAccessDeniedProps) {
  const [pending, startTransition] = useTransition();

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
    <Card className="mx-auto max-w-md border-0 shadow-none bg-transparent">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <IconComponent className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{message}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {signInHref && (
          <Button
            render={<Link href={signInHref} />}
            size="lg"
            className="w-full min-h-[48px]"
            aria-label={signInLabel || "Continue"}
          >
            {signInLabel || "Continue"}
          </Button>
        )}
        {returnHref && (
          <Button
            variant="outline"
            render={<Link href={returnHref} />}
            size="lg"
            className="w-full min-h-[48px]"
          >
            Back to exam
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
