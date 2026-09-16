"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import {
  PrototypeAdminIcon,
  type PrototypeAdminIconName,
} from "@/components/admin/prototype-admin-icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

function mobileRoutesFor(surface: ApplicationSurface, role?: string) {
  const routes = routesFor(surface, role);

  if (surface === "student") {
    return { primary: routes.slice(0, 5), overflow: routes.slice(5) };
  }

  const preferredHrefs = role === "administrator"
    ? ["/workspace", "/workspace/students", "/workspace/exams", "/workspace/reports"]
    : ["/workspace", "/workspace/students", "/workspace/exams", "/workspace/classes"];
  const utilityHrefs = new Set(["/workspace/settings"]);
  const candidates = routes.filter((route) => !utilityHrefs.has(route.href));
  const primary = preferredHrefs
    .map((href) => candidates.find((route) => route.href === href))
    .filter((route): route is ApplicationRoute => Boolean(route));
  const primaryHrefs = new Set(primary.map((route) => route.href));
  const overflow = candidates.filter((route) => !primaryHrefs.has(route.href));
  return { primary, overflow };
}

export function useApplicationNavItem(surface: ApplicationSurface, role?: string) {
  const pathname = usePathname();
  const routes = routesFor(surface, role);
  return routes.find((entry) => isCurrent(pathname, entry.href)) ?? routes[0];
}

export function ApplicationNav({
  surface,
  role,
}: {
  surface: ApplicationSurface;
  role?: string;
}) {
  const pathname = usePathname();
  const routes = routesFor(surface, role);
  const label = surface === "student" ? "Student navigation" : "Staff navigation";

  return (
    <nav
      className="no-scrollbar flex-1 overflow-y-auto px-3 pb-3"
      aria-label={label}
    >
      <div className="flex flex-col gap-1">
        {routes.map((route) => {
          const active = isCurrent(pathname, route.href);
          return (
            <Link
              key={route.href}
              href={route.href}
              aria-current={active ? "page" : undefined}
              className="group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-neutral-400 transition motion-safe:duration-200 hover:bg-neutral-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 aria-[current=page]:bg-white aria-[current=page]:text-neutral-950 aria-[current=page]:shadow-sm"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-transparent transition group-aria-[current=page]:border-neutral-200 group-aria-[current=page]:bg-neutral-50">
                <PrototypeAdminIcon name={route.icon} className="size-4 shrink-0" />
              </span>
              <span>{route.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileNavLink({
  route,
  active,
  onNavigate,
}: {
  route: ApplicationRoute;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={route.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className="group flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[10px] font-semibold text-neutral-500 outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-950 aria-[current=page]:text-neutral-950"
    >
      <span className="grid size-8 place-items-center rounded-xl transition group-aria-[current=page]:bg-neutral-950 group-aria-[current=page]:text-white">
        <PrototypeAdminIcon name={route.icon} className="size-5 shrink-0" />
      </span>
      <span className="max-w-full truncate">{route.label}</span>
    </Link>
  );
}

export function MobileBottomNavigation({
  surface,
  role,
}: {
  surface: ApplicationSurface;
  role?: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { primary, overflow } = mobileRoutesFor(surface, role);
  const overflowActive = overflow.some((route) => isCurrent(pathname, route.href));
  const controlCount = primary.length + (overflow.length ? 1 : 0);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-xl lg:hidden"
      aria-label="Mobile application navigation"
    >
      <div
        className={cn(
          "mx-auto grid max-w-xl",
          controlCount === 5 ? "grid-cols-5" : controlCount === 4 ? "grid-cols-4" : controlCount === 3 ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {primary.map((route) => (
          <MobileNavLink
            key={route.href}
            route={route}
            active={isCurrent(pathname, route.href)}
          />
        ))}

        {overflow.length ? (
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              render={(
                <button
                  type="button"
                  className={cn(
                    "group flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[10px] font-semibold text-neutral-500 outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-950",
                    overflowActive && "text-neutral-950",
                  )}
                  aria-label="More navigation"
                  aria-current={overflowActive ? "page" : undefined}
                />
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-xl transition",
                  overflowActive && "bg-neutral-950 text-white",
                )}
              >
                <PrototypeAdminIcon name="more" className="size-5 shrink-0" />
              </span>
              <span>More</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[72dvh] gap-0 overflow-y-auto rounded-t-3xl border-neutral-200 bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] text-neutral-950"
            >
              <SheetHeader className="border-b border-neutral-100 px-5 pb-4 pt-5 text-left">
                <SheetTitle className="font-display text-lg font-extrabold">More workspace</SheetTitle>
                <SheetDescription>
                  Additional destinations that are used less often on mobile.
                </SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 p-4">
                {overflow.map((route) => {
                  const active = isCurrent(pathname, route.href);
                  return (
                    <Link
                      key={route.href}
                      href={route.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className="flex min-h-20 flex-col justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left text-sm font-semibold text-neutral-700 outline-none transition hover:border-neutral-300 hover:bg-neutral-100 focus-visible:ring-4 focus-visible:ring-neutral-200 aria-[current=page]:border-neutral-950 aria-[current=page]:bg-neutral-950 aria-[current=page]:text-white"
                    >
                      <PrototypeAdminIcon name={route.icon} className="size-5 shrink-0" />
                      <span>{route.label}</span>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </nav>
  );
}
