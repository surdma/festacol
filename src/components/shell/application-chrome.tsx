"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { signOutSessionAction } from "@/app/actions/auth";
import { PrototypeAdminIcon } from "@/components/admin/prototype-admin-icon";
import {
  type ApplicationSurface,
  useApplicationNavItem,
} from "@/components/shell/application-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ApplicationNotification } from "@/types/admin";

const btnPrimary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-px hover:bg-neutral-800 hover:shadow-sm active:translate-y-0 active:scale-[.98] focus:outline-none focus:ring-4 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
const iconBtn = "relative inline-flex size-10 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-700 transition motion-safe:duration-200 hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 hover:text-black hover:shadow-sm active:translate-y-0 active:scale-[.96] focus:outline-none focus:ring-4 focus:ring-neutral-200";
const field = "block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 transition focus:border-black focus:ring-black";
const NOTIFICATION_PREVIEW_LIMIT = 5;

const toneClass: Record<ApplicationNotification["tone"], string> = {
  amber: "bg-warning/10 text-warning-foreground",
  blue: "bg-info/10 text-info-foreground",
  red: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

const iconName: Record<ApplicationNotification["icon"], "book" | "clock" | "shield" | "qr" | "chart" | "school"> = {
  book: "book",
  clock: "clock",
  shield: "shield",
  qr: "qr",
  chart: "chart",
  school: "school",
};

function NotificationsMenu({
  notifications,
  surface,
}: {
  notifications: ApplicationNotification[];
  surface: ApplicationSurface;
}) {
  const visible = notifications.slice(0, NOTIFICATION_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, notifications.length - visible.length);
  const countLabel = hiddenCount ? `${NOTIFICATION_PREVIEW_LIMIT}+` : String(visible.length);
  const eyebrow = surface === "student" ? "Student updates" : "Activity centre";
  const historyHref = surface === "student" ? "/dashboard/history" : "/workspace/students";
  const historyLabel = surface === "student" ? "Open exam history" : "Open student records";

  return (
    <Popover>
      <PopoverTrigger
        render={(
          <button type="button" className={iconBtn} aria-label={`Current updates, ${notifications.length} signal${notifications.length === 1 ? "" : "s"}`} />
        )}
      >
        <PrototypeAdminIcon name="bell" />
        {visible.length ? (
          <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-neutral-950 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {countLabel}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,410px)] gap-0 rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-xl"
      >
        <PopoverHeader className="border-b border-border px-4 pb-3 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{eyebrow}</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <div>
              <PopoverTitle className="font-display text-base font-extrabold">Now</PopoverTitle>
              <PopoverDescription className="mt-1 text-xs leading-5 text-muted-foreground">
                A short list of current signals. Long-term activity stays in the durable record, not in this popover.
              </PopoverDescription>
            </div>
            {visible.length ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
                {hiddenCount ? `${visible.length} shown` : visible.length}
              </span>
            ) : null}
          </div>
        </PopoverHeader>

        <div className="p-2">
          {visible.length ? (
            <div className="divide-y divide-border">
              {visible.map((notification) => (
                <div key={notification.id} className="flex min-h-14 items-start gap-3 rounded-xl px-3 py-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass[notification.tone]}`}>
                    <PrototypeAdminIcon name={iconName[notification.icon]} className="size-4 shrink-0" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xs leading-5 text-foreground">{notification.title}</strong>
                    <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{notification.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
                <PrototypeAdminIcon name="check" className="size-4 shrink-0" />
              </span>
              <span>
                <strong className="block text-xs">You’re caught up</strong>
                <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
                  Festacol will surface only current items that need attention here.
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-[11px] leading-4 text-muted-foreground">
            {hiddenCount ? `+${hiddenCount} more current signal${hiddenCount === 1 ? "" : "s"} available in the workspace.` : "Historical records are kept outside the bell."}
          </span>
          <Link href={historyHref} className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            {historyLabel}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ApplicationTopbar({
  surface,
  role,
  profileName,
  profileDetail,
  notifications = [],
}: {
  surface: ApplicationSurface;
  role: string;
  profileName: string;
  profileDetail?: string | null;
  notifications?: ApplicationNotification[];
}) {
  const item = useApplicationNavItem(surface, role);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const isStudent = surface === "student";
  const isAdmin = role === "administrator";
  const sectionLabel = isStudent ? "Student portal" : isAdmin ? "Administration" : "Teaching";
  const profileInitial = profileName.trim().charAt(0).toUpperCase() || sectionLabel.charAt(0);
  const settingsHref = isStudent ? "/dashboard/profile" : "/workspace/settings";

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">{sectionLabel} / {item?.label ?? "Workspace"}</p>
          <p className="truncate text-sm font-bold">{item?.label ?? "Workspace"}</p>
        </div>

        {!isStudent ? (
          <form
            className="relative hidden w-full max-w-xs md:block"
            onSubmit={(event) => {
              event.preventDefault();
              const value = query.trim();
              router.push(value ? `/workspace/students?q=${encodeURIComponent(value)}` : "/workspace/students");
            }}
          >
            <label>
              <span className="sr-only">Search students</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <PrototypeAdminIcon name="search" className="size-4 shrink-0" />
              </span>
              <input
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={`${field} pl-9`}
                placeholder="Search student name or ID"
              />
            </label>
          </form>
        ) : null}

        {!isStudent ? (
          <Link href="/workspace/exams?modal=create-exam" className={`${btnPrimary} hidden sm:inline-flex`}>
            <PrototypeAdminIcon name="plus" className="size-4 shrink-0" />
            Create exam
          </Link>
        ) : null}

        <NotificationsMenu notifications={notifications} surface={surface} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={(
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-1.5 pr-2.5 text-left transition hover:border-neutral-400 hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-neutral-200"
                aria-label="Open profile menu"
              />
            )}
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-neutral-950 text-xs font-bold text-white">{profileInitial}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-36 sm:block">
              <strong className="block truncate text-xs text-neutral-900">{profileName}</strong>
              <span className="block truncate text-[10px] text-neutral-500">{profileDetail || sectionLabel}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(88vw,280px)] rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
            <div className="border-b border-neutral-100 px-3 pb-3 pt-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-neutral-950 font-bold text-white">{profileInitial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-neutral-950">{profileName}</strong>
                  <span className="block truncate text-xs text-neutral-500">{profileDetail || sectionLabel}</span>
                </div>
              </div>
            </div>
            <DropdownMenuGroup className="p-1">
              <DropdownMenuItem render={<Link href={settingsHref} />} className="rounded-xl py-2.5">
                <Settings className="size-4" aria-hidden="true" />
                {isStudent ? "Profile" : "Profile & settings"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <div className="border-t border-neutral-100 p-1 pt-2">
              <form action={signOutSessionAction}>
                <input type="hidden" name="surface" value={surface} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
