"use client";

import { ArrowUpRight, Bell, BookOpenCheck, CheckCircle2, Clock3, LogOut, Menu, Plus, QrCode, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminLiveBadge } from "@/app/admin/live-badge";
import { signOutAdminAction } from "@/app/actions/admin-auth";
import { AdminNav, useAdminNavItem } from "@/components/admin/admin-nav";
import { adminIconButtonClass, adminPrimaryButtonClass } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AdminTopbarNotification } from "@/types/admin";

export function AdminSidebarBrand() {
  return (
    <Link href="/admin" className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-neutral-700">
      <span className="grid size-10 place-items-center rounded-xl bg-white font-display text-sm font-black text-neutral-950 shadow-sm">F</span>
      <span>
        <strong className="block font-display text-base text-white">Festacol</strong>
        <span className="text-xs text-neutral-400">Academic operations</span>
      </span>
    </Link>
  );
}

export function AdminSidebarFooter({ displayName, email, role }: { displayName: string; email: string; role: string }) {
  return (
    <div className="border-t border-neutral-800 p-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <strong className="block text-xs text-neutral-100">School workspace</strong>
            <span className="mt-1 block text-[11px] leading-4 text-neutral-500">Records are saved and shared across every device.</span>
            <div className="mt-2"><AdminLiveBadge /></div>
          </div>
        </div>
        <div className="mt-3 border-t border-neutral-800 pt-3">
          <p className="truncate text-[11px] font-semibold text-neutral-300">{displayName}</p>
          <p className="mt-0.5 truncate text-[10px] capitalize text-neutral-500">{email || role}</p>
          <form action={signOutAdminAction} className="mt-2">
            <button type="submit" className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-700">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" variant="outline" size="icon" className={`${adminIconButtonClass} lg:hidden`} aria-label="Open navigation" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" showCloseButton className="w-[min(88vw,320px)] max-w-none gap-0 border-r border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl">
        <SheetHeader className="border-b border-neutral-200 p-4 pr-14 text-left">
          <SheetTitle className="font-display font-extrabold">Festacol Admin</SheetTitle>
          <SheetDescription className="text-xs text-neutral-500">Academic operations</SheetDescription>
        </SheetHeader>
        <AdminNav mobile onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

const notificationIcons = {
  book: BookOpenCheck,
  clock: Clock3,
  shield: ShieldAlert,
  qr: QrCode,
} as const;

const notificationTones = {
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  red: "bg-red-50 text-red-700",
  neutral: "bg-neutral-100 text-neutral-700",
} as const;

export function AdminTopbar({ notifications }: { notifications: AdminTopbarNotification[] }) {
  const item = useAdminNavItem();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNavigation />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">Administration / {item.label}</p>
          <p className="truncate text-sm font-bold text-neutral-950">{item.label}</p>
        </div>

        <form action="/admin/students" method="get" className="relative hidden w-full max-w-xs md:block">
          <label>
            <span className="sr-only">Search students</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input name="q" className="block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 pl-9 text-sm text-neutral-950 placeholder:text-neutral-400 transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/15" placeholder="Search student name or ID" />
          </label>
        </form>

        <Button render={<Link href="/admin/exams?modal=create-exam" />} className={`${adminPrimaryButtonClass} hidden sm:inline-flex`}>
          <Plus className="size-4" /> Create exam
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon" className={adminIconButtonClass} aria-label="Notifications" />}>
            <Bell className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(92vw,360px)] rounded-2xl border-neutral-200 bg-white p-2 shadow-xl">
            <DropdownMenuLabel className="border-b border-neutral-100 px-3 pb-3 pt-2">
              <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Activity centre</span>
              <span className="mt-1 flex items-center justify-between gap-3">
                <span className="font-display text-base font-extrabold text-neutral-950">Needs attention</span>
                <span className="text-xs font-semibold text-neutral-400">{notifications.length}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuGroup className="grid gap-1 p-1">
              {notifications.length ? notifications.map((notification) => {
                const Icon = notificationIcons[notification.icon];
                return (
                  <DropdownMenuItem key={`${notification.href}-${notification.title}`} render={<Link href={notification.href} />} className="group flex items-start gap-3 rounded-xl p-3 text-left focus:bg-neutral-50">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${notificationTones[notification.tone]}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-xs text-neutral-900">{notification.title}</strong>
                      <span className="mt-1 block text-[11px] leading-4 text-neutral-500">{notification.detail}</span>
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-neutral-300 transition group-hover:text-neutral-600" />
                  </DropdownMenuItem>
                );
              }) : (
                <div className="flex gap-3 rounded-xl p-3" role="status">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-4" /></span>
                  <span>
                    <strong className="block text-xs text-neutral-900">No immediate exceptions</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-neutral-500">Draft, active-attempt, integrity and communication queues are clear.</span>
                  </span>
                </div>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
