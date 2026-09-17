import { Toaster } from "@/components/ui/toast";

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  // Candidate entry is intentionally outside the dashboard shell. The page
  // owns auth/onboarding because a first-time student must be able to reach
  // the credential step before an Auth session exists. Exam allocation and
  // rendering still require a verified active student server-side.
  return (
    <Toaster timeout={6000}>
      <main className="min-h-dvh bg-background">{children}</main>
    </Toaster>
  );
}
