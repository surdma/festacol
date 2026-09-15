import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon?: LucideIcon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {detail ? <CardDescription>{detail}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
