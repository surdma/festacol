"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { signOutSessionAction } from "@/app/actions/auth";
import { PrototypeAdminIcon } from "@/components/admin/prototype-admin-icon";
import {
  type ApplicationSurface,
  useApplicationNavItem,
} from "@/components/shell/application-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

const toneClass: Record<ApplicationNotification["tone"], string> = {
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  red: "bg-red-50 text-red-700",
  neutral: "bg-neutral-100 text-neutral-700",
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
  const countLabel = notifications.length > 9 ? "9+" : String(notifications.length);
  const eyebrow = surface === "student" ? "Student updates" : "Activity centre";

  return (
    <Popover>
      <PopoverTrigger
        render={(
          <button type="button" className={iconBtn} aria-label={`Notifications, ${notifications.length} current`} />
        )}
      >
        <PrototypeAdminIcon name="bell" />
        {notifications.length ? (
          <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-neutral-950 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {countLabel}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,390px)] gap-0 rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-xl"
      >
        <PopoverHeader className="border-b border-neutral-100 px-4 pb-3 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">{eyebrow}</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <div>
              <PopoverTitle className="font-display text-base font-extrabold">Notifications</PopoverTitle>
              <PopoverDescription className="mt-1 text-xs leading-5 text-neutral-500">
                Select a notification to expand its full message.
              </PopoverDescription>
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-500">
              {notifications.length}
            </span>
          </div>
        </PopoverHeader>

        <div className="no-scrollbar max-h-[min(60dvh,520px)] overflow-y-auto p-2">
          {notifications.length ? (
            <div className="flex flex-col gap-1">
              {notifications.map((notification) => (
                <Collapsible key={notification.id}>
                  <CollapsibleTrigger className="group flex w-full items-start gap-3 rounded-xl p-3 text-left outline-none transition hover:bg-neutral-50 focus-visible:ring-4 focus-visible:ring-neutral-200">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass[notification.tone]}`}>
                      <PrototypeAdminIcon name={iconName[notification.icon]} className="size-4 shrink-0" />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <strong className="block text-xs leading-5 text-neutral-900">{notification.title}</strong>
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-neutral-400">
                        Tap to read message
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-neutral-400 transition-transform group-aria-expanded:rotate-180"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pl-[3.75rem] pr-4 text-xs leading-5 text-neutral-600">
                    {notification.detail}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <PrototypeAdminIcon name="check" className="size-4 shrink-0" />
              </span>
              <span>
                <strong className="block text-xs">Nothing needs your attention</strong>
                <span className="mt-1 block text-[11px] leading-5 text-neutral-500">
                  Current academic and account activity will appear here when there is something useful to review.
                </span>
              </span>
            </div>
          )}
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
