"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PrototypeAdminIcon,
  type PrototypeAdminIconName,
} from "@/components/admin/prototype-admin-icon";

export type ApplicationSurface = "student" | "staff";

interface ApplicationRoute {
  href: string;
  label: string;
  icon: PrototypeAdminIconName;
  administratorOnly?: boolean;
}

const staffRoutes: ApplicationRoute[] = [
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

const studentRoutes: ApplicationRoute[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "chart" },
  { href: "/dashboard/history", label: "Exam history", icon: "book" },
  { href: "/dashboard/progress", label: "Progress & promotion", icon: "school" },
  { href: "/dashboard/profile", label: "Profile", icon: "users" },
];

function routesFor(surface: ApplicationSurface, role?: string) {
  const routes = surface === "student" ? studentRoutes : staffRoutes;
  return routes.filter((route) => !route.administratorOnly || role === "administrator");
}

function isCurrent(pathname: string, href: string) {
  return href === "/workspace" || href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function useApplicationNavItem(surface: ApplicationSurface, role?: string) {
  const pathname = usePathname();
  const routes = routesFor(surface, role);
  return routes.find((entry) => isCurrent(pathname, entry.href)) ?? routes[0];
}

export function ApplicationNav({
  surface,
  role,
  mobile = false,
  onNavigate,
}: {
  surface: ApplicationSurface;
  role?: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const routes = routesFor(surface, role);
  const label = surface === "student" ? "Student navigation" : "Staff navigation";

  return (
    <nav
      className={mobile ? "no-scrollbar flex-1 overflow-y-auto p-3" : "no-scrollbar flex-1 overflow-y-auto px-3 pb-3"}
      aria-label={mobile ? `Mobile ${label.toLowerCase()}` : label}
    >
      <div className="flex flex-col gap-1">
        {routes.map((route) => {
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
      </div>
    </nav>
  );
}
