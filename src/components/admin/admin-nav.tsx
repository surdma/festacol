"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav } from "@/lib/nav";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function AdminNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {adminNav.map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={active}
              tooltip={item.label}
              className="h-10 text-neutral-400 hover:bg-neutral-900 hover:text-white data-active:bg-white data-active:text-neutral-950"
            >
              <item.icon data-icon="inline-start" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AdminBreadcrumbLabel() {
  const pathname = usePathname();
  const item = adminNav.find((entry) => entry.href === "/admin" ? pathname === entry.href : pathname.startsWith(entry.href));
  return <span className="font-medium text-foreground">{item?.label ?? "Administration"}</span>;
}
