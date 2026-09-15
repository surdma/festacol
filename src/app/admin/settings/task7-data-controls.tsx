"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, DatabaseZap, MessageCircleOff, Trash2 } from "lucide-react";
import { clearAdminDataScopeAction, type AdminDataScope } from "@/app/actions/task7-settings";
import { adminSurfaceClass } from "@/components/admin/admin-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const CONTROLS: {
  scope: AdminDataScope;
  title: string;
  detail: string;
  confirm: string;
  icon: typeof Trash2;
}[] = [
  {
    scope: "sessions",
    title: "Remove examination sessions",
    detail: "Deletes exam definitions and live session-owned state. Submitted attempt records remain for audit history but their session foreign key becomes empty.",
    confirm: "Delete all exam sessions",
    icon: BookOpenCheck,
  },
  {
    scope: "activity",
    title: "Clear examination activity",
    detail: "Deletes attempts, answer/stat rows, integrity events and live/resume markers. Exam definitions and the question bank remain.",
    confirm: "Clear all exam activity",
    icon: DatabaseZap,
  },
  {
    scope: "whatsapp",
    title: "Clear WhatsApp mappings",
    detail: "Removes stored class communication invite mappings. Classes and students are not deleted.",
    confirm: "Clear WhatsApp mappings",
    icon: MessageCircleOff,
  },
  {
    scope: "custom-questions",
    title: "Remove authored questions",
    detail: "Deletes only questions with a staff/admin creator. Bank-seeded questions with no creator are preserved.",
    confirm: "Delete authored questions",
    icon: Trash2,
  },
];

export function Task7DataControls() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function clear(scope: AdminDataScope) {
    setMessage(null);
    startTransition(async () => {
      const result = await clearAdminDataScopeAction(scope);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error ?? "The requested data could not be cleared." });
        return;
      }
      setMessage({ tone: "success", text: "The selected production data scope was cleared." });
      router.refresh();
    });
  }

  return (
    <section className={`${adminSurfaceClass} overflow-hidden`}>
      <div className="border-b border-neutral-200 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-500">Data management</p>
        <h2 className="mt-1 font-display text-lg font-extrabold text-neutral-950">Scoped production cleanup</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-500">These actions operate on Supabase/Postgres records, not browser-local prototype data. Each control names exactly what it removes and what it preserves.</p>
      </div>

      {message ? <div className={`m-5 rounded-xl border p-3 text-sm ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role="status">{message.text}</div> : null}

      <div className="grid gap-px bg-neutral-200 sm:grid-cols-2">
        {CONTROLS.map((control) => {
          const Icon = control.icon;
          return (
            <article key={control.scope} className="bg-white p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-neutral-700"><Icon className="size-4" /></span>
              <h3 className="mt-4 text-sm font-bold text-neutral-950">{control.title}</h3>
              <p className="mt-2 min-h-14 text-xs leading-5 text-neutral-500">{control.detail}</p>
              <AlertDialog>
                <AlertDialogTrigger render={<Button type="button" variant="outline" disabled={pending} className="mt-4 border-red-200 text-red-700 hover:bg-red-50" />}>
                  <Trash2 data-icon="inline-start" />{control.title}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{control.title}?</AlertDialogTitle>
                    <AlertDialogDescription>{control.detail} This action affects shared production data and cannot be undone from this interface.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={pending} onClick={() => clear(control.scope)}>{control.confirm}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </article>
          );
        })}
      </div>
    </section>
  );
}
