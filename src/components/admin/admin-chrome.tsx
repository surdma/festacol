"use client";

import { Bell, CheckCircle2, ExternalLink, LogOut, Menu, Plus, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminLiveBadge } from "@/app/admin/live-badge";
import { signOutAdminAction } from "@/app/actions/admin-auth";
import { AdminNav, useAdminNavItem } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { adminIconButtonClass, adminPrimaryButtonClass } from "@/components/admin/admin-ui";

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

export function AdminTopbar({ displayName, role }: { displayName: string; role: string }) {
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
          <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon" className={adminIconButtonClass} aria-label="Administration shortcuts" />}>
            <Bell className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(92vw,360px)] rounded-2xl border-neutral-200 bg-white p-2 shadow-xl">
            <DropdownMenuLabel className="px-3 pb-3 pt-2">
              <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Activity centre</span>
              <span className="mt-1 block font-display text-base font-extrabold text-neutral-950">Needs attention</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-neutral-100" />
            <DropdownMenuItem render={<Link href="/admin/exams?status=draft" />} className="rounded-xl p-3 text-xs">Review draft examinations</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/admin/reports?view=integrity" />} className="rounded-xl p-3 text-xs">Review integrity events</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/admin/classes" />} className="rounded-xl p-3 text-xs">Review class communication</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="icon" variant="outline" render={<Link href="/dashboard" target="_blank" />} className="hidden size-10 rounded-lg border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 sm:inline-flex" aria-label="Open student portal">
          <ExternalLink className="size-4" />
        </Button>

        <Link href="/admin/settings" className="hidden h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 xl:flex" aria-label={`Signed in as ${displayName}, ${role}`}>
          <ShieldCheck className="size-4" />
          <span className="max-w-28 truncate">{displayName}</span>
        </Link>
      </div>
    </header>
  );
}
