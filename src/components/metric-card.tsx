import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon?: LucideIcon }) {
  return (
    <Card className="relative min-h-32">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
        {detail ? <CardDescription className="mt-2 text-xs leading-5">{detail}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
