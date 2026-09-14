"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { adminNav } from "@/lib/nav";

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className={mobile ? "space-y-1 p-3" : "flex-1 space-y-1 overflow-y-auto px-3 pb-3"} aria-label={mobile ? "Mobile administration" : "Administration"}>
      {adminNav.map((item) => {
        const active = isCurrent(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition motion-safe:duration-200 focus:outline-none",
              mobile
                ? "min-h-11 text-neutral-600 hover:bg-neutral-100 hover:text-black focus:ring-4 focus:ring-neutral-200 aria-[current=page]:bg-black aria-[current=page]:text-white"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-white focus:ring-2 focus:ring-neutral-700 aria-[current=page]:bg-white aria-[current=page]:text-neutral-950 aria-[current=page]:shadow-sm",
            )}
          >
            <span className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg border border-transparent transition",
              !mobile && "group-aria-[current=page]:border-neutral-200 group-aria-[current=page]:bg-neutral-50",
            )}>
              <Icon className={mobile ? "size-5" : "size-4"} strokeWidth={1.9} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function useAdminNavItem() {
  const pathname = usePathname();
  return adminNav.find((entry) => isCurrent(pathname, entry.href)) ?? adminNav[0];
}

export function AdminBreadcrumbLabel() {
  const item = useAdminNavItem();
  return <span className="font-medium text-neutral-950">{item.label}</span>;
}
