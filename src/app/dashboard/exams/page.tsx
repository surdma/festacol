import { redirect } from "next/navigation";

// Legacy student route consolidation: "My exams" was subsumed by the single
// history list. Bookmarks land on the unified attempt list instead of 404ing.
export default function ExamsRedirect() {
  redirect("/dashboard/history");
}
