"use client";

import { BookOpenCheck, ChevronRight, GraduationCap, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_ITEMS = [
  { href: "/admin/settings", label: "Settings overview", detail: "School-wide setup at a glance", icon: SlidersHorizontal, exact: true },
  { href: "/admin/settings/academic", label: "Academic setup", detail: "Years, terms, levels and subjects", icon: GraduationCap },
  { href: "/admin/settings/account", label: "Account & access", detail: "Your staff account and sign-in", icon: ShieldCheck },
];

const TEACHER_ITEMS = [
  { href: "/admin/settings", label: "Settings overview", detail: "Your teaching access at a glance", icon: SlidersHorizontal, exact: true },
  { href: "/admin/settings/teaching", label: "Teaching subjects", detail: "Subjects you are qualified to teach", icon: BookOpenCheck },
  { href: "/admin/settings/account", label: "Account & access", detail: "Your staff account and sign-in", icon: ShieldCheck },
];

export function SettingsNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = role === "administrator" ? ADMIN_ITEMS : TEACHER_ITEMS;

  return (
    <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-1 lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-w-[220px] items-center gap-3 rounded-xl border px-3 py-3 transition focus:outline-none focus:ring-4 focus:ring-neutral-200 lg:min-w-0",
              active
                ? "border-neutral-950 bg-neutral-950 text-white shadow-sm"
                : "border-transparent bg-transparent text-neutral-600 hover:border-neutral-200 hover:bg-white hover:text-neutral-950",
            )}
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", active ? "bg-white/10 text-white" : "bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200")}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">{item.label}</strong>
              <span className={cn("mt-0.5 block truncate text-[11px]", active ? "text-neutral-300" : "text-neutral-500")}>{item.detail}</span>
            </span>
            <ChevronRight className={cn("size-4 shrink-0", active ? "text-neutral-400" : "text-neutral-300 group-hover:text-neutral-500")} />
          </Link>
        );
      })}
    </nav>
  );
}
