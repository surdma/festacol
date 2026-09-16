"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PrototypeAdminIcon, type PrototypeAdminIconName } from "@/components/admin/prototype-admin-icon";

interface AdminRoute {
  href: string;
  label: string;
  icon: PrototypeAdminIconName;
  administratorOnly?: boolean;
}

const routes: AdminRoute[] = [
  { href: "/workspace", label: "Overview", icon: "home" },
  { href: "/workspace/students", label: "Students", icon: "users" },
  { href: "/workspace/staff", label: "Staff", icon: "staff", administratorOnly: true },
  { href: "/workspace/exams", label: "Examinations", icon: "book" },
  { href: "/workspace/classes", label: "Classes", icon: "school" },
  { href: "/workspace/questions", label: "Question Bank", icon: "book" },
  { href: "/workspace/reports", label: "Reports", icon: "chart" },
  { href: "/workspace/settings", label: "Settings", icon: "cog" },
  { href: "/workspace/data-library", label: "School Data", icon: "school", administratorOnly: true },
];

function isCurrent(pathname: string, href: string) {
  return href === "/workspace" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function visibleRoutes(role?: string) {
  return routes.filter((route) => !route.administratorOnly || role === "administrator");
}

export function useAdminNavItem() {
  const pathname = usePathname();
  return routes.find((entry) => isCurrent(pathname, entry.href)) ?? routes[0];
}

export function AdminNav({ role, mobile = false, onNavigate }: { role?: string; mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className={mobile ? "no-scrollbar flex-1 space-y-1 overflow-y-auto p-3" : "no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 pb-3"} aria-label={mobile ? "Mobile administration" : "Administration"}>
      {visibleRoutes(role).map((route) => {
        const active = isCurrent(pathname, route.href);
        return (
          <Link
            key={route.href}
            href={route.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={mobile
              ? "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-black focus:outline-none focus:ring-4 focus:ring-neutral-200 aria-[current=page]:bg-black aria-[current=page]:text-white"
              : "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-neutral-400 transition motion-safe:duration-200 hover:bg-neutral-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 aria-[current=page]:bg-white aria-[current=page]:text-neutral-950 aria-[current=page]:shadow-sm"}
          >
            <span className={mobile ? undefined : "grid size-8 shrink-0 place-items-center rounded-lg border border-transparent transition group-aria-[current=page]:border-neutral-200 group-aria-[current=page]:bg-neutral-50"}>
              <PrototypeAdminIcon name={route.icon} className={mobile ? "size-5 shrink-0" : "size-4 shrink-0"} />
            </span>
            <span>{route.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
