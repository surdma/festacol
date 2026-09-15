"use server";

import type { ActionResult } from "@/app/actions/student";
import {
  seedSubjectCatalogFromFixtureAction,
  syncQuestionBankFromFixtureAction,
} from "@/app/actions/question-bank";

export async function seedSubjectCatalogFromBankAction(): Promise<ActionResult & { count?: number }> {
  return seedSubjectCatalogFromFixtureAction();
}

export async function syncProductionQuestionBankAction(): Promise<ActionResult & { count?: number }> {
  return syncQuestionBankFromFixtureAction();
}
