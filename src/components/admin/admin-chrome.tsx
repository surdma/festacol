"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, LogOut, Plus, Settings2, ShieldCheck } from "lucide-react";
import { AdminLiveBadge } from "@/app/admin/live-badge";
import { signOutAdminAction } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAdminNavItem } from "@/components/admin/admin-nav";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "FA";
}

export function AdminSidebarBrand() {
  const reduceMotion = useReducedMotion();

  return (
    <Link
      href="/admin"
      className="group/brand flex min-h-14 items-center gap-3 rounded-[18px] px-2 outline-none ring-white/30 transition-colors hover:bg-white/[0.055] focus-visible:ring-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
    >
      <motion.span
        whileHover={reduceMotion ? undefined : { scale: 1.04, rotate: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-white text-sm font-black tracking-[-0.04em] text-neutral-950 shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
      >
        F
      </motion.span>
      <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <span className="flex items-center gap-2">
          <strong className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">Festacol</strong>
          <span className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Admin</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-neutral-500">Academic operations</span>
      </span>
    </Link>
  );
}

export function AdminSidebarFooter({
  displayName,
  email,
  role,
}: {
  displayName: string;
  email: string;
  role: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
      <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-white/[0.09] text-[11px] font-bold text-white ring-1 ring-white/10">
          {initials(displayName)}
        </span>
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <strong className="block truncate text-xs font-semibold text-neutral-100">{displayName}</strong>
          <span className="mt-0.5 block truncate text-[10px] capitalize text-neutral-500">{role}</span>
        </span>
        <span
          className="size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.08)] group-data-[collapsible=icon]:hidden"
          aria-hidden="true"
        />
        <span className="sr-only">Connected</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 group-data-[collapsible=icon]:hidden">
        <Button
          size="sm"
          variant="ghost"
          render={<Link href="/admin/settings" />}
          className="h-8 justify-start rounded-[10px] px-2 text-[11px] text-neutral-400 hover:bg-white/[0.07] hover:text-white"
        >
          <Settings2 data-icon="inline-start" className="size-3.5" />
          Settings
        </Button>
        <form action={signOutAdminAction}>
          <button
            type="submit"
            className="flex h-8 w-full items-center justify-start gap-1.5 rounded-[10px] px-2 text-[11px] font-medium text-neutral-400 outline-none transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-white/25"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </form>
      </div>
      <span className="sr-only">Signed in as {email || displayName}</span>
    </div>
  );
}

export function AdminTopbar({
  displayName,
  role,
}: {
  displayName: string;
  role: string;
}) {
  const item = useAdminNavItem();
  const reduceMotion = useReducedMotion();
  const Icon = item.icon;

  return (
    <motion.header
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0.12 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/88 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/78 sm:px-5"
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1600px] items-center gap-3">
        <SidebarTrigger className="size-10 shrink-0 rounded-[13px] border border-black/[0.07] bg-white shadow-sm hover:bg-neutral-50" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="hidden size-9 shrink-0 place-items-center rounded-[12px] bg-neutral-950 text-white shadow-sm sm:grid">
            <Icon className="size-4" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-400">
              <span>Administration</span>
              <span className="size-1 rounded-full bg-neutral-300" aria-hidden="true" />
              <span>{item.section}</span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
              <span className="truncate text-sm font-semibold tracking-[-0.02em] text-neutral-950 sm:text-[15px]">{item.label}</span>
              <span className="hidden truncate text-xs text-neutral-400 lg:inline">{item.description}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden lg:block"><AdminLiveBadge /></div>
          <Button
            size="sm"
            render={<Link href="/admin/exams?modal=create-exam" />}
            className="hidden h-9 rounded-[12px] px-3 shadow-sm md:inline-flex"
          >
            <Plus data-icon="inline-start" className="size-4" />
            New exam
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            render={<Link href="/dashboard" target="_blank" />}
            className="hidden size-9 rounded-[12px] bg-white sm:inline-flex"
            aria-label="Open student portal"
          >
            <ExternalLink />
          </Button>
          <Link
            href="/admin/settings"
            className="flex h-10 items-center gap-2 rounded-[14px] border border-black/[0.07] bg-white px-1.5 pr-2.5 shadow-sm outline-none transition-[background-color,box-shadow] hover:bg-neutral-50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-neutral-400/40"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-neutral-950 text-[9px] font-bold text-white">{initials(displayName)}</span>
            <span className="hidden min-w-0 leading-none xl:block">
              <strong className="block max-w-28 truncate text-[11px] font-semibold text-neutral-900">{displayName}</strong>
              <span className="mt-1 flex items-center gap-1 text-[9px] capitalize text-neutral-400"><ShieldCheck className="size-2.5" />{role}</span>
            </span>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
