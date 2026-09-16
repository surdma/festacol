"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminLiveBadge } from "@/app/admin/live-badge";
import { AdminNav, useAdminNavItem } from "@/components/admin/admin-nav";
import { PrototypeAdminIcon } from "@/components/admin/prototype-admin-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AdminTopbarNotification } from "@/types/admin";

const btnPrimary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition motion-safe:duration-200 motion-safe:ease-out hover:-translate-y-px hover:bg-neutral-800 hover:shadow-sm active:translate-y-0 active:scale-[.98] focus:outline-none focus:ring-4 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
const iconBtn = "inline-flex size-10 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-700 transition motion-safe:duration-200 hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-100 hover:text-black hover:shadow-sm active:translate-y-0 active:scale-[.96] focus:outline-none focus:ring-4 focus:ring-neutral-200";
const field = "block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 transition focus:border-black focus:ring-black";

const toneClass: Record<AdminTopbarNotification["tone"], string> = {
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  red: "bg-red-50 text-red-700",
  neutral: "bg-neutral-100 text-neutral-700",
};

const iconName: Record<AdminTopbarNotification["icon"], "book" | "clock" | "shield" | "qr"> = {
  book: "book",
  clock: "clock",
  shield: "shield",
  qr: "qr",
};

export function AdminSidebarBrand() {
  return (
    <Link href="/admin" className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-white font-display text-sm font-black text-neutral-950 shadow-sm">F</span>
      <span><strong className="block font-display text-base">Festacol</strong><span className="text-xs text-neutral-400">Academic operations</span></span>
    </Link>
  );
}

export function AdminSidebarFooter() {
  return (
    <div className="border-t border-neutral-800 p-4">
      <div className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <span className="mt-0.5 text-emerald-400"><PrototypeAdminIcon name="check" className="size-4 shrink-0" /></span>
        <span>
          <strong className="block text-xs text-neutral-100">School workspace</strong>
          <span className="mt-1 block text-[11px] leading-4 text-neutral-500">Records are saved and shared across every device.</span>
          <span className="mt-2 block"><AdminLiveBadge /></span>
        </span>
      </div>
    </div>
  );
}

function MobileNavigation({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const isAdmin = role === "administrator";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<button type="button" className={`${iconBtn} lg:hidden`} aria-label="Open navigation" />}>
        <PrototypeAdminIcon name="menu" />
      </SheetTrigger>
      <SheetContent side="left" showCloseButton={false} overlayClassName="bg-black/40 backdrop-blur-sm" className="no-scrollbar w-[min(88vw,320px)] max-w-none gap-0 overflow-y-auto border-r border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl data-[side=left]:data-starting-style:-translate-x-full data-[side=left]:data-ending-style:-translate-x-full lg:hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4">
          <div>
            <SheetTitle className="font-display font-bold text-neutral-950">{isAdmin ? "Festacol Administration" : "Festacol Teaching"}</SheetTitle>
            <SheetDescription className="text-xs text-neutral-500">{isAdmin ? "School management" : "Teaching workspace"}</SheetDescription>
          </div>
          <SheetClose render={<button type="button" className={iconBtn} aria-label="Close navigation" />}>
            <PrototypeAdminIcon name="close" />
          </SheetClose>
        </div>
        <AdminNav role={role} mobile onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AdminTopbar({ notifications, role }: { notifications: AdminTopbarNotification[]; role: string }) {
  const item = useAdminNavItem();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const isAdmin = role === "administrator";

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNavigation role={role} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">{isAdmin ? "Administration" : "Teaching"} / {item.label}</p>
          <p className="truncate text-sm font-bold">{item.label}</p>
        </div>

        <form
          className="relative hidden w-full max-w-xs md:block"
          onSubmit={(event) => {
            event.preventDefault();
            const value = query.trim();
            router.push(value ? `/admin/students?q=${encodeURIComponent(value)}` : "/admin/students");
          }}
        >
          <label>
            <span className="sr-only">Search students</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"><PrototypeAdminIcon name="search" className="size-4 shrink-0" /></span>
            <input name="q" value={query} onChange={(event) => setQuery(event.target.value)} className={`${field} pl-9`} placeholder="Search student name or ID" />
          </label>
        </form>

        <Link href="/admin/exams?modal=create-exam" className={`${btnPrimary} hidden sm:inline-flex`}>
          <PrototypeAdminIcon name="plus" className="size-4 shrink-0" />Create exam
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className={iconBtn} aria-label="Notifications" />}>
            <PrototypeAdminIcon name="bell" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-40 w-[min(92vw,360px)] rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
            <div className="border-b border-neutral-100 px-3 pb-3 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Activity centre</p>
              <div className="mt-1 flex items-center justify-between gap-3"><h3 className="font-display text-base font-extrabold">Needs attention</h3><span className="text-xs font-semibold text-neutral-400">{notifications.length}</span></div>
            </div>
            <DropdownMenuGroup className="grid gap-1 p-1">
              {notifications.length ? notifications.map((notification) => (
                <DropdownMenuItem key={`${notification.href}-${notification.title}`} render={<Link href={notification.href} />} className="group flex gap-3 rounded-xl p-3 transition hover:bg-neutral-50 focus:bg-neutral-50">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass[notification.tone]}`}><PrototypeAdminIcon name={iconName[notification.icon]} className="size-4 shrink-0" /></span>
                  <span className="min-w-0 flex-1"><strong className="block text-xs text-neutral-900">{notification.title}</strong><span className="mt-1 block text-[11px] leading-4 text-neutral-500">{notification.detail}</span></span>
                  <PrototypeAdminIcon name="external" className="size-3.5 shrink-0 text-neutral-300 transition group-hover:text-neutral-600" />
                </DropdownMenuItem>
              )) : (
                <div className="flex gap-3 rounded-xl p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><PrototypeAdminIcon name="check" className="size-4 shrink-0" /></span>
                  <span><strong className="block text-xs">No immediate items</strong><span className="mt-1 block text-[11px] leading-4 text-neutral-500">There is nothing requiring attention right now.</span></span>
                </div>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
