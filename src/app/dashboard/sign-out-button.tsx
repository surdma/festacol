"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { useStudent } from "@/hooks/use-student";

function SignOutInner() {
  const { signOut } = useStudent();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const returnTo = token
    ? `/dashboard/exam?token=${encodeURIComponent(token)}`
    : undefined;
  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-2 w-full"
      onClick={() => signOut(returnTo)}
    >
      Sign out
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Suspense>
      <SignOutInner />
    </Suspense>
  );
}
