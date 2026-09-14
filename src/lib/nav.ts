import { BookOpen, Users, GraduationCap, ClipboardList, School, Library, BarChart3, Settings, LayoutDashboard } from "lucide-react";

export const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/staff", label: "Staff", icon: GraduationCap },
  { href: "/admin/exams", label: "Examinations", icon: BookOpen },
  { href: "/admin/classes", label: "Classes", icon: School },
  { href: "/admin/questions", label: "Question Bank", icon: Library },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

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
