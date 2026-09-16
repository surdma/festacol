import Link from "next/link";
import type { ReactNode } from "react";
import { ApplicationTopbar } from "@/components/shell/application-chrome";
import {
  ApplicationNav,
  MobileBottomNavigation,
  type ApplicationSurface,
} from "@/components/shell/application-nav";
import { Toaster } from "@/components/ui/toast";
import type { ApplicationNotification } from "@/types/admin";

export function ApplicationShell({
  children,
  surface,
  role,
  profileName,
  profileDetail,
  notifications = [],
  sidebarStatus,
  overlays,
}: {
  children: ReactNode;
  surface: ApplicationSurface;
  role: string;
  profileName: string;
  profileDetail?: string | null;
  notifications?: ApplicationNotification[];
  sidebarStatus?: ReactNode;
  overlays?: ReactNode;
}) {
  const isStudent = surface === "student";
  const brandHref = isStudent ? "/dashboard" : "/workspace";
  const brandSubtitle = isStudent ? "Student workspace" : "Academic operations";
  const navLabel = isStudent ? "Student" : "Workspace";

  return (
    <Toaster timeout={6000}>
      <div className="min-h-dvh bg-neutral-50 text-neutral-950">
        <a
          href="#application-root"
          className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition focus:translate-y-0 focus:outline-none focus:ring-4 focus:ring-neutral-300 motion-reduce:transition-none"
        >
          Skip to application
        </a>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden border-r border-neutral-800 bg-neutral-950 text-white lg:flex lg:flex-col">
          <div className="border-b border-neutral-800 px-5 py-5">
            <Link href={brandHref} className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white font-display text-sm font-black text-neutral-950 shadow-sm">F</span>
              <span>
                <strong className="block font-display text-base">Festacol</strong>
                <span className="text-xs text-neutral-400">{brandSubtitle}</span>
              </span>
            </Link>
          </div>
          <div className="px-4 pb-2 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-neutral-500">{navLabel}</p>
          </div>
          <ApplicationNav surface={surface} role={role} />
          <div className="border-t border-neutral-800 p-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
              <strong className="block truncate text-xs text-neutral-100">{profileName}</strong>
              <span className="mt-1 block truncate text-[11px] leading-4 text-neutral-500">{profileDetail || brandSubtitle}</span>
              {sidebarStatus ? <span className="mt-2 block">{sidebarStatus}</span> : null}
            </div>
          </div>
        </aside>

        <div className="lg:pl-64">
          <ApplicationTopbar
            surface={surface}
            role={role}
            profileName={profileName}
            profileDetail={profileDetail}
            notifications={notifications}
          />
          <main
            id="application-root"
            tabIndex={-1}
            className="mx-auto max-w-[1600px] px-4 pb-28 pt-5 outline-none sm:px-6 lg:px-8 lg:pb-5"
          >
            {children}
          </main>
        </div>

        <MobileBottomNavigation surface={surface} role={role} />
        {overlays}
      </div>
    </Toaster>
  );
}
