"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { adminNav, adminNavGroups } from "@/lib/nav";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Administration navigation" className="space-y-1">
      {adminNavGroups.map((group) => (
        <SidebarGroup key={group.section} className="px-2 py-2.5 first:pt-1">
          <SidebarGroupLabel className="mb-1 h-7 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
            {group.section}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {group.items.map((item) => {
                const active = isCurrent(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                      className="relative h-11 overflow-hidden rounded-[14px] px-3 text-neutral-400 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white data-active:bg-transparent data-active:text-neutral-950 group-data-[collapsible=icon]:justify-center"
                    >
                      {active ? (
                        <motion.span
                          aria-hidden="true"
                          layoutId={reduceMotion ? undefined : "admin-navigation-active"}
                          className="absolute inset-0 rounded-[14px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.16)]"
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34, mass: 0.7 }}
                        />
                      ) : null}
                      <item.icon className="relative z-10 size-[18px]" strokeWidth={active ? 2.15 : 1.8} />
                      <span className="relative z-10 font-medium tracking-[-0.01em]">{item.label}</span>
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
