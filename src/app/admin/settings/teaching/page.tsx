import { BookOpenCheck, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { MajorPicker } from "@/components/admin/major-picker";
import { currentStaff } from "@/lib/auth/staff";

export default async function TeachingSettingsPage() {
  const { scope } = await currentStaff();
  if (!scope.isTeacher) redirect("/admin/settings");

  return (
    <div>
      <AdminPageHeader eyebrow="Teaching subjects" title="Your subject qualifications" description="Choose the subjects that reflect your teaching qualification. These selections shape the question banks available in your teaching workspace." />

      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><BookOpenCheck className="size-4" /></span><h2 className="mt-3 text-sm font-bold text-neutral-950">Subject access</h2><p className="mt-1 text-xs leading-5 text-neutral-500">Your selected subjects determine which subject question banks you can work with.</p></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><span className="grid size-9 place-items-center rounded-xl bg-neutral-950 text-white"><ShieldCheck className="size-4" /></span><h2 className="mt-3 text-sm font-bold text-neutral-950">Class responsibilities</h2><p className="mt-1 text-xs leading-5 text-neutral-500">Actual classes and examinations still follow assignments made by school administration.</p></article>
      </section>

      <MajorPicker />
    </div>
  );
}
