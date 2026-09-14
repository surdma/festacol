import {
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Library,
  School,
  Settings,
  Users,
} from "lucide-react";

export const adminNav = [
  {
    href: "/admin",
    label: "Overview",
    description: "Command center",
    section: "Workspace",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/students",
    label: "Students",
    description: "Directory and records",
    section: "People",
    icon: Users,
  },
  {
    href: "/admin/staff",
    label: "Staff",
    description: "Access and subject scope",
    section: "People",
    icon: GraduationCap,
  },
  {
    href: "/admin/classes",
    label: "Classes",
    description: "Structure and communication",
    section: "People",
    icon: School,
  },
  {
    href: "/admin/exams",
    label: "Examinations",
    description: "Assessment control",
    section: "Assessment",
    icon: BookOpen,
  },
  {
    href: "/admin/questions",
    label: "Question Bank",
    description: "Question inventory",
    section: "Assessment",
    icon: Library,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    description: "Performance and audit",
    section: "Assessment",
    icon: BarChart3,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    description: "Workspace configuration",
    section: "System",
    icon: Settings,
  },
] as const;

export const adminNavGroups = ["Workspace", "People", "Assessment", "System"].map((section) => ({
  section,
  items: adminNav.filter((item) => item.section === section),
}));

export const studentNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/exams", label: "My exams", icon: ClipboardList },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/history", label: "Exam history", icon: BookOpen },
  { href: "/dashboard/progress", label: "Progress & promotion", icon: GraduationCap },
  { href: "/dashboard/profile", label: "Profile", icon: Users },
] as const;
// NOTE: /dashboard/exam is intentionally NOT in studentNav — hidden route,
// reachable only via encoded ?session= link, QR, or Exam-ID dialog.
