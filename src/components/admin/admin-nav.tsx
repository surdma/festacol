"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { adminNav, adminNavGroups } from "@/lib/nav";

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const compact = state === "collapsed" && !isMobile;

  function handleNavigate() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <nav aria-label="Administration navigation" className="flex min-h-0 flex-1 flex-col gap-1">
      {adminNavGroups.map((group) => (
        <SidebarGroup key={group.section} className="px-2 py-1.5 first:pt-1">
          <AnimatePresence initial={false}>
            {!compact ? (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
              >
                <SidebarGroupLabel className="mb-1 h-7 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/35">
                  {group.section}
                </SidebarGroupLabel>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {group.items.map((item) => {
                const active = isCurrent(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={handleNavigate} />}
                      isActive={active}
                      tooltip={item.label}
                      className={cn(
                        "group/nav-item relative h-11 overflow-hidden rounded-[15px] px-2.5 text-sidebar-foreground/58 transition-[color,transform,background-color] duration-200 ease-out hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-active:bg-transparent data-active:font-medium data-active:text-sidebar-primary-foreground",
                        "group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
                      )}
                    >
                      {active ? (
                        <motion.span
                          aria-hidden="true"
                          layoutId={reduceMotion ? undefined : "admin-navigation-active"}
                          className="absolute inset-0 rounded-[15px] bg-sidebar-primary shadow-[0_10px_28px_rgba(0,0,0,0.24)]"
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 420, damping: 34, mass: 0.72 }
                          }
                        />
                      ) : null}

                      <span
                        className={cn(
                          "relative z-10 grid size-8 shrink-0 place-items-center rounded-[11px] transition-[background-color,color,box-shadow] duration-200",
                          active
                            ? "bg-sidebar text-sidebar-foreground shadow-sm"
                            : "bg-sidebar-accent/60 text-sidebar-foreground/65 group-hover/nav-item:bg-sidebar-accent group-hover/nav-item:text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="size-[17px]" strokeWidth={active ? 2.1 : 1.85} />
                      </span>

                      <AnimatePresence initial={false}>
                        {!compact ? (
                          <motion.span
                            initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
                            className="relative z-10 min-w-0 truncate font-medium tracking-[-0.01em]"
                          >
                            {item.label}
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}

export function useAdminNavItem() {
  const pathname = usePathname();
  return adminNav.find((entry) => isCurrent(pathname, entry.href)) ?? adminNav[0];
}

export function AdminBreadcrumbLabel() {
  const item = useAdminNavItem();
  return <span className="font-medium text-foreground">{item.label}</span>;
}
