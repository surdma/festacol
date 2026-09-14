import { Badge } from "@/components/ui/badge";

const tones: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  emerald: "default",
  blue: "secondary",
  amber: "outline",
  red: "destructive",
  neutral: "secondary",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: keyof typeof tones | string; children: React.ReactNode }) {
  const variant = (tones[tone] ?? "secondary") as "default" | "secondary" | "destructive" | "outline";
  return <Badge variant={variant}>{children}</Badge>;
}
