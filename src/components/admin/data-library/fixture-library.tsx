"use client";

import {
  ArrowRight,
  Database,
  Eye,
  FileJson2,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { SchoolDataManifestItem, SchoolDataSource } from "@/app/actions/fixture-library";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSchoolDataLibrary } from "@/hooks/use-school-data-library";

type DatabaseCounts = { subjects: number; classes: number; questions: number };

function databaseCount(source: SchoolDataSource, counts: DatabaseCounts) {
  if (source === "subjects") return counts.subjects;
  if (source === "academic-structure") return counts.classes;
  return counts.questions;
}

function dependencyState(source: SchoolDataSource, counts: DatabaseCounts) {
  if (source === "subjects") return { ready: true, label: "No dependency" };
  if (source === "academic-structure") {
    return counts.subjects > 0
      ? { ready: true, label: "Subjects available" }
      : { ready: false, label: "Load subjects first" };
  }
  return counts.subjects > 0 && counts.classes > 0
    ? { ready: true, label: "Subjects & structure available" }
    : { ready: false, label: "Load dependencies first" };
}

function dependencyName(source: SchoolDataSource) {
  if (source === "subjects") return "Subject curriculum";
  if (source === "academic-structure") return "Academic structure";
  return "Question bank";
}

function LoadConfirmation({ item, ready, pending, running, load }: {
  item: SchoolDataManifestItem;
  ready: boolean;
  pending: boolean;
  running: boolean;
  load: (source: SchoolDataSource) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" disabled={pending || !ready} />}>
        {running ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
        {running ? "Loading…" : "Load fixture"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Load {item.title.toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>
            This loads the approved bundled fixture into the production school database. {item.safeguard}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => load(item.source)}>Load fixture</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FixtureDetailSheet({ item, counts, pending, activeSource, load }: {
  item: SchoolDataManifestItem;
  counts: DatabaseCounts;
  pending: boolean;
  activeSource: SchoolDataSource | null;
  load: (source: SchoolDataSource) => void;
}) {
  const dependency = dependencyState(item.source, counts);
  const running = pending && activeSource === item.source;

  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <Eye data-icon="inline-start" />
        Inspect
      </SheetTrigger>
      <SheetContent className="w-[min(96vw,560px)] max-w-none overflow-y-auto">
        <SheetHeader className="border-b border-border">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="outline">Schema v{item.schemaVersion}</Badge>
            <Badge variant={dependency.ready ? "secondary" : "destructive"}>{dependency.ready ? "Ready" : "Blocked"}</Badge>
          </div>
          <SheetTitle className="mt-2 font-display text-xl font-extrabold">{item.title}</SheetTitle>
          <SheetDescription>{item.description}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Fixture identity</p>
            <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr]"><dt className="text-muted-foreground">Identifier</dt><dd className="break-all font-medium text-foreground">{item.identifier}</dd></div>
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr]"><dt className="text-muted-foreground">Bundled records</dt><dd className="font-medium tabular-nums text-foreground">{item.bundledRecords}</dd></div>
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr]"><dt className="text-muted-foreground">Database records</dt><dd className="font-medium tabular-nums text-foreground">{databaseCount(item.source, counts)}</dd></div>
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr]"><dt className="text-muted-foreground">Composition</dt><dd className="font-medium text-foreground">{item.detail}</dd></div>
            </dl>
          </section>

          <section>
            <div className="flex items-center gap-2"><FileJson2 className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">Source files</h3></div>
            <div className="mt-3 divide-y divide-border border-y border-border">
              {item.files.map((file) => <p key={file} className="break-all py-2.5 font-mono text-xs text-muted-foreground">{file}</p>)}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2"><GitBranch className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">Dependency order</h3></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.dependsOn.length ? item.dependsOn.map((source) => <Badge key={source} variant="outline">{dependencyName(source)}</Badge>) : <Badge variant="secondary">First in sequence</Badge>}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{dependency.label}</p>
          </section>

          <section>
            <div className="flex items-center gap-2"><Database className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold text-foreground">Affected database relations</h3></div>
            <div className="mt-3 flex flex-wrap gap-2">{item.affects.map((table) => <Badge key={table} variant="outline">{table}</Badge>)}</div>
          </section>

          <Alert>
            <ShieldCheck />
            <AlertTitle>Load safeguard</AlertTitle>
            <AlertDescription>{item.safeguard}</AlertDescription>
          </Alert>

          {!dependency.ready ? (
            <Alert variant="destructive">
              <GitBranch />
              <AlertTitle>Dependency is not ready</AlertTitle>
              <AlertDescription>{dependency.label}. Load the preceding fixture before this source.</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border bg-muted/20">
          <LoadConfirmation item={item} ready={dependency.ready} pending={pending} running={running} load={load} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FixtureLibrary({ manifest, counts }: { manifest: SchoolDataManifestItem[]; counts: DatabaseCounts }) {
  const { pending, activeSource, feedback, load } = useSchoolDataLibrary();

  return (
    <section aria-labelledby="fixture-manifest-heading">
      <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Approved fixture manifest</p>
          <h2 id="fixture-manifest-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">Data sources & load order</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Inspect the exact bundled files and their dependencies before loading them. Database counts are live; bundled counts come from the JSON fixtures.</p>
        </div>
        <Badge variant="outline">{manifest.length} logical sources</Badge>
      </div>

      {feedback ? (
        <Alert variant={feedback.tone === "error" ? "destructive" : "default"} className="mb-4">
          <Database />
          <AlertTitle>{feedback.tone === "error" ? "Fixture load failed" : "Fixture load completed"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="border-y border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Schema</TableHead>
              <TableHead className="text-right">Bundled</TableHead>
              <TableHead className="text-right">Database</TableHead>
              <TableHead className="hidden lg:table-cell">Dependency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {manifest.map((item, index) => {
              const current = databaseCount(item.source, counts);
              const dependency = dependencyState(item.source, counts);
              const running = pending && activeSource === item.source;
              return (
                <TableRow key={item.source}>
                  <TableCell className="min-w-[220px] whitespace-normal py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background font-mono text-[11px] font-bold text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">v{item.schemaVersion}</Badge></TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{item.bundledRecords}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{current}</TableCell>
                  <TableCell className="hidden lg:table-cell"><Badge variant={dependency.ready ? "secondary" : "destructive"}>{dependency.label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <FixtureDetailSheet item={item} counts={counts} pending={pending} activeSource={activeSource} load={load} />
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button type="button" size="sm" disabled={pending || !dependency.ready} />}>
                          {running ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
                          <span className="hidden xl:inline">{running ? "Loading…" : current ? "Refresh" : "Load"}</span>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Load {item.title.toLowerCase()}?</AlertDialogTitle>
                            <AlertDialogDescription>This applies the approved fixture to production records. {item.safeguard}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction disabled={pending} onClick={() => load(item.source)}>Continue</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
        Load in sequence: subject curriculum → academic structure → question bank. Staff-created questions remain outside fixture ownership.
      </div>
    </section>
  );
}
