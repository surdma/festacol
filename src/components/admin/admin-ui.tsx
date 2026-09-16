import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const adminSurfaceClass = "rounded-2xl border border-neutral-200 bg-white shadow-sm";
export const adminIconButtonClass = "inline-flex size-10 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-700 transition motion-safe:duration-200 hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 hover:text-black hover:shadow-sm active:translate-y-0 active:scale-[.96] focus:outline-none focus:ring-4 focus:ring-neutral-200";
export const adminPrimaryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-px hover:bg-neutral-800 hover:shadow-sm active:translate-y-0 active:scale-[.98] focus:outline-none focus:ring-4 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
export const adminSecondaryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 hover:shadow-sm active:translate-y-0 active:scale-[.98] focus:outline-none focus:ring-4 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
export const adminDangerButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-px hover:bg-red-800 active:translate-y-0 active:scale-[.98] focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-40";

export function AdminPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[.16em] text-neutral-500">{eyebrow}</p> : null}
        <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-600">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminSearchForm({ query, placeholder, hidden = {}, className }: { query?: string; placeholder: string; hidden?: Record<string, string | undefined>; className?: string }) {
  return (
    <form method="get" className={cn("min-w-0 flex-1", className)}>
      {Object.entries(hidden).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
      <label className="relative block min-w-0">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input name="q" defaultValue={query} placeholder={placeholder} className="block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 pl-9 text-sm text-neutral-950 placeholder:text-neutral-400 transition focus:border-black focus:ring-black" />
      </label>
    </form>
  );
}

export interface AdminFilterOption { value: string; label: string }

export function AdminFilterLinks({ pathname, param, current, options, preserve = {} }: { pathname: string; param: string; current: string; options: AdminFilterOption[]; preserve?: Record<string, string | undefined> }) {
  return (
    <div className="flex max-w-full overflow-x-auto rounded-lg border border-neutral-300 bg-white p-1" aria-label={`${param} filter`}>
      {options.map((option) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(preserve)) if (value) search.set(key, value);
        if (option.value && option.value !== "all") search.set(param, option.value);
        const href = search.size ? `${pathname}?${search.toString()}` : pathname;
        const active = current === option.value || (!current && option.value === "all");
        return (
          <Link
            key={option.value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              buttonVariants({ size: "sm", variant: "ghost" }),
              "min-h-9 whitespace-nowrap rounded-md px-3 text-xs font-semibold shadow-none hover:bg-neutral-100 hover:text-neutral-950",
              active && "bg-black text-white hover:bg-black hover:text-white",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminSectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
      <div>
        {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">{eyebrow}</p> : null}
        <h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function AdminMetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon?: LucideIcon }) {
  return (
    <article className="group rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition motion-safe:duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">{label}</p><strong className="mt-2 block font-display text-2xl font-extrabold tracking-tight text-neutral-950 tabular-nums sm:text-3xl">{value}</strong></div>
        {Icon ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-950 text-white transition motion-safe:duration-200 group-hover:scale-105"><Icon className="size-4" /></span> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500">{detail}</p>
    </article>
  );
}

export function AdminEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-52 place-items-center p-7 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-11 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-500"><BookOpenCheck className="size-5" /></span>
        <h2 className="mt-4 font-display text-lg font-extrabold text-neutral-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
