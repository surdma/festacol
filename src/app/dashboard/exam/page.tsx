import { redirect } from "next/navigation";

export default async function LegacyDashboardExamPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = String((await searchParams).token ?? "").trim();
  redirect(token ? `/exam?token=${encodeURIComponent(token)}` : "/exam");
}
