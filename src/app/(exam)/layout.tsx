import { currentStudent } from "@/lib/auth/current-student";
import { AccessDenied } from "@/components/access-denied";

export default async function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Standalone exam shell: no sidebar/header chrome. Student role only.
  // Staff/anon handled by proxy and explicit deny at page layer.
  const ctx = await currentStudent();
  if (!ctx) {
    return (
      <main className="min-h-dvh bg-background">
        <div className="mx-auto max-w-md p-6">
          <AccessDenied
            title="Exam access required"
            message="Sign in with your student account to open this exam."
            signInHref={`/?next=${encodeURIComponent("/exam")}`}
            signInLabel="Go to sign in"
          />
        </div>
      </main>
    );
  }
  return <main className="min-h-dvh bg-background">{children}</main>;
}
