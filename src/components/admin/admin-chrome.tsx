"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "cn";
import { ExternalLink, LogOut, Plus, Settings2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { AdminLiveBadge } from "@/app/admin/live-badge";
import { signOutAdminAction } from "@/app/actions/admin-auth";
import { useAdminNavItem } from "@/components/admin/admin-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const { isMobile, setOpenMobile, state } = useSidebar();
  const compact = state === "collapsed" && !isMobile;

  return (
    <div className="flex min-h-14 items-center gap-1.5">
      <Link
        href="/admin"
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
        className={cn(
          "group/brand flex min-w-0 flex-1 items-center gap-3 rounded-[17px] px-2 py-2 outline-none transition-colors duration-200 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          compact && "justify-center px-0",
        )}
      >
        <motion.span
          whileHover={reduceMotion ? undefined : { scale: 1.035, rotate: -1.5 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 440, damping: 28 }}
          className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-sidebar-primary text-sm font-black tracking-[-0.04em] text-sidebar-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
        >
          F
        </motion.span>

        <AnimatePresence initial={false}>
          {!compact ? (
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
              className="min-w-0 flex-1"
            >
              <span className="flex items-center gap-2">
                <strong className="truncate text-[15px] font-semibold tracking-[-0.02em] text-sidebar-foreground">
                  Festacol
                </strong>
                <span className="rounded-md border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/55">
                  Admin
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-sidebar-foreground/42">Academic operations</span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </Link>

      {isMobile ? (
        <Button
          type="button"
          size="icon-lg"
          variant="ghost"
          onClick={() => setOpenMobile(false)}
          className="size-11 shrink-0 rounded-[13px] text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Close sidebar"
        >
          <X />
        </Button>
      ) : (
        <SidebarTrigger className="size-9 shrink-0 rounded-[12px] text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden" />
      )}
    </div>
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
  const reduceMotion = useReducedMotion();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const compact = state === "collapsed" && !isMobile;

  function closeMobileSidebar() {
    if (isMobile) setOpenMobile(false);
  }

  if (compact) {
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
        className="flex flex-col items-center gap-2 rounded-[18px] border border-sidebar-border bg-sidebar-accent/35 p-2"
      >
        <span className="relative grid size-10 place-items-center rounded-[13px] bg-sidebar-accent text-[10px] font-bold text-sidebar-foreground ring-1 ring-sidebar-border">
          {initials(displayName)}
          <span className="absolute -right-0.5 -bottom-0.5 grid size-3 place-items-center rounded-full bg-sidebar">
            <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          </span>
        </span>
        <span className="sr-only">Connected</span>

        <div className="flex flex-col gap-1.5" role="group" aria-label="Account actions">
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/admin/settings"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-lg" }),
                    "size-11 rounded-[13px] text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  aria-label="Settings"
                />
              }
            >
              <Settings2 />
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>

          <form action={signOutAdminAction}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    size="icon-lg"
                    variant="ghost"
                    className="size-11 rounded-[13px] text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    aria-label="Sign out"
                  />
                }
              >
                <LogOut />
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </form>
        </div>
        <span className="sr-only">Signed in as {email || displayName}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
      className="rounded-[20px] border border-sidebar-border bg-sidebar-accent/35 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
    >
      <div className="flex items-center gap-2.5 rounded-[14px] px-1 py-1">
        <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-sidebar-accent text-[11px] font-bold text-sidebar-foreground ring-1 ring-sidebar-border">
          {initials(displayName)}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs font-semibold text-sidebar-foreground">{displayName}</strong>
          <span className="mt-0.5 block truncate text-[10px] capitalize text-sidebar-foreground/42">{role}</span>
        </span>
        <span className="relative flex size-3 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="absolute size-2 rounded-full bg-emerald-400/20" />
          <span className="relative size-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="sr-only">Connected</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Link
          href="/admin/settings"
          onClick={closeMobileSidebar}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-11 justify-start rounded-[13px] px-3 text-xs text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Settings2 data-icon="inline-start" />
          Settings
        </Link>
        <form action={signOutAdminAction}>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="h-11 w-full justify-start rounded-[13px] px-3 text-xs text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </form>
      </div>
      <span className="sr-only">Signed in as {email || displayName}</span>
    </motion.div>
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
