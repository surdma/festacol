import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminSearchForm({
  query,
  placeholder,
  hidden = {},
  className,
}: {
  query?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
  className?: string;
}) {
  return (
    <form method="get" className={cn("flex min-w-0 flex-1 gap-2", className)}>
      {Object.entries(hidden).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={query} placeholder={placeholder} className="pl-9" />
      </label>
      <Button type="submit" variant="outline">Search</Button>
    </form>
  );
}

export interface AdminFilterOption {
  value: string;
  label: string;
}

export function AdminFilterLinks({
  pathname,
  param,
  current,
  options,
  preserve = {},
}: {
  pathname: string;
  param: string;
  current: string;
  options: AdminFilterOption[];
  preserve?: Record<string, string | undefined>;
}) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1" aria-label={`${param} filter`}>
      {options.map((option) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(preserve)) if (value) search.set(key, value);
        if (option.value && option.value !== "all") search.set(param, option.value);
        const href = search.size ? `${pathname}?${search.toString()}` : pathname;
        const active = current === option.value || (!current && option.value === "all");
        return (
          <Button
            key={option.value}
            size="sm"
            variant={active ? "default" : "ghost"}
            render={<Link href={href} />}
            className="whitespace-nowrap"
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export function AdminSectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p> : null}
        <h2 className="mt-1 text-base font-semibold sm:text-lg">{title}</h2>
      </div>
      {action}
    </div>
  );
}
