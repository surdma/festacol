"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="size-5" /></span>
        <h1 className="mt-4 text-xl font-semibold">Administration workspace could not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{error.message || "A production data request failed before this admin view could render."}</p>
        <Button className="mt-5" onClick={reset}><RotateCcw data-icon="inline-start" />Try again</Button>
      </CardContent>
    </Card>
  );
}
