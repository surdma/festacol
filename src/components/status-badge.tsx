import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  emerald: "border-success-border bg-success text-success-foreground",
  blue: "border-info-border bg-info text-info-foreground",
  amber: "border-warning-border bg-warning text-warning-foreground",
  red: "border-destructive/20 bg-destructive/10 text-destructive",
  neutral: "border-transparent bg-muted text-muted-foreground",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: keyof typeof tones | string; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("capitalize", tones[tone] ?? tones.neutral)}>
      {children}
    </Badge>
  );
}
