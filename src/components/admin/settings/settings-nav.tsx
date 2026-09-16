"use client";

import {
  BookOpenCheck,
  Database,
  GraduationCap,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  href: string;
  label: string;
  detail: string;
  icon: typeof SlidersHorizontal;
  exact?: boolean;
  group: "settings" | "operations";
}

const ADMIN_ITEMS: SettingsNavItem[] = [
  {
    href: "/admin/settings",
    label: "Configuration",
    detail: "School settings health and actions",
    icon: SlidersHorizontal,
    exact: true,
    group: "settings",
  },
  {
    href: "/admin/settings/academic",
    label: "Academic structure",
    detail: "Calendar, curriculum and subjects",
    icon: GraduationCap,
    group: "settings",
  },
  {
    href: "/admin/settings/account",
    label: "Account & access",
    detail: "Administrator identity and session",
    icon: ShieldCheck,
    group: "settings",
  },
  {
    href: "/admin/data-library",
    label: "School data",
    detail: "Fixture manifest, loading and maintenance",
    icon: Database,
    group: "operations",
  },
];

const TEACHER_ITEMS: SettingsNavItem[] = [
  {
    href: "/admin/settings",
    label: "My configuration",
    detail: "Teaching access and assignment health",
    icon: SlidersHorizontal,
    exact: true,
    group: "settings",
  },
  {
    href: "/admin/settings/teaching",
    label: "Teaching scope",
    detail: "Qualifications and current assignments",
    icon: BookOpenCheck,
    group: "settings",
  },
  {
    href: "/admin/settings/account",
    label: "Account & access",
    detail: "Staff identity and sign-in session",
    icon: ShieldCheck,
    group: "settings",
  },
];

function NavItems({ items, pathname }: { items: SettingsNavItem[]; pathname: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-w-[210px] items-center gap-3 border-b-2 px-2 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 lg:min-w-0 lg:border-b-0 lg:border-l-2 lg:px-3",
              active
                ? "border-foreground bg-muted/60 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg border bg-background transition-colors",
                active ? "border-foreground text-foreground" : "border-border text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm font-semibold">{item.label}</strong>
              <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">{item.detail}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function SettingsNav({ role }: { role: string }) {
  const pathname = usePathname();
  const items = role === "administrator" ? ADMIN_ITEMS : TEACHER_ITEMS;
  const settingsItems = items.filter((item) => item.group === "settings");
  const operationItems = items.filter((item) => item.group === "operations");

  return (
    <nav aria-label="Settings sections" className="min-w-0">
      <div className="mb-3 hidden items-center justify-between gap-2 lg:flex">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            {role === "administrator" ? "School settings" : "My settings"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {role === "administrator"
              ? "Configure persisted school structure and administrator tools."
              : "Manage only the teaching settings available to your role."}
          </p>
        </div>
        <Badge variant="outline">{role === "administrator" ? "Admin" : "Teacher"}</Badge>
      </div>

      <NavItems items={settingsItems} pathname={pathname} />

      {operationItems.length ? (
        <div className="mt-4 hidden lg:block">
          <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Operations</p>
          <NavItems items={operationItems} pathname={pathname} />
        </div>
      ) : null}

      {operationItems.length ? (
        <div className="mt-1 lg:hidden">
          <NavItems items={operationItems} pathname={pathname} />
        </div>
      ) : null}
    </nav>
  );
}
