"use server";

import type { ActionResult } from "@/app/actions/student";
import { seedSubjectsAction, syncQuestionBankAction } from "@/app/actions/admin";

// The seed file may still carry historical subject codes as import metadata,
// but codes are resolved to canonical subject names inside the server action
// and are never persisted as subject identity.
export async function seedSubjectCatalogFromBankAction(): Promise<ActionResult & { count?: number }> {
  return seedSubjectsAction();
}

export async function syncProductionQuestionBankAction(): Promise<ActionResult & { count?: number }> {
  return syncQuestionBankAction();
}
