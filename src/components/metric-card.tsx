import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon?: LucideIcon }) {
  return (
    <Card className="relative min-h-32 min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent className="min-w-0">
        <p className="font-display min-w-0 text-2xl font-extrabold tabular-nums tracking-tight break-words">{value}</p>
        {detail ? <CardDescription className="mt-2 text-xs leading-5 break-words">{detail}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
