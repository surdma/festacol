"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MoreHorizontal, Rows3 } from "lucide-react";
import { AdminTablePagination, useAdminTablePagination } from "@/components/admin/admin-table-pagination";
import { StatusBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminIconButtonClass } from "@/components/admin/admin-ui";
import type { QuestionRow } from "@/types/db";

export interface QuestionDirectoryRow extends QuestionRow {
  subjectName: string;
}

export function QuestionDirectoryTable({ rows }: { rows: QuestionDirectoryRow[] }) {
  const { page, pageSize, pageCount, pageRows, setPage, setPageSize } = useAdminTablePagination(rows, 15);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const visibleIds = new Set(rows.map((row) => row.id));
    setSelected((current) => new Set([...current].filter((id) => visibleIds.has(id))));
  }, [rows]);

  const currentIds = pageRows.map((row) => row.id);
  const allCurrentSelected = currentIds.length > 0 && currentIds.every((id) => selected.has(id));

  function toggleAllCurrent(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of currentIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function toggleOne(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-xs">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-foreground px-4 py-3 text-background">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Rows3 className="size-4" aria-hidden="true" />
            {selected.size} question{selected.size === 1 ? "" : "s"} selected
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-10 pl-4">
              <Checkbox
                aria-label="Select questions on this page"
                checked={allCurrentSelected}
                onCheckedChange={(checked) => toggleAllCurrent(Boolean(checked))}
              />
            </TableHead>
            <TableHead className="min-w-80">Question</TableHead>
            <TableHead className="min-w-40">Subject</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="w-14"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((item) => {
            const href = `/workspace/questions?modal=question&question=${item.id}`;
            return (
              <TableRow key={item.id} data-state={selected.has(item.id) ? "selected" : undefined}>
                <TableCell className="pl-4">
                  <Checkbox
                    aria-label={`Select question ${item.id}`}
                    checked={selected.has(item.id)}
                    onCheckedChange={(checked) => toggleOne(item.id, Boolean(checked))}
                  />
                </TableCell>
                <TableCell className="max-w-xl whitespace-normal">
                  <Link href={href} className="block rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <strong className="line-clamp-2 text-foreground">{item.prompt || `Question ${item.id}`}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">#{item.id}{item.domain ? ` · ${item.domain}` : ""}</span>
                  </Link>
                </TableCell>
                <TableCell>{item.subjectName}</TableCell>
                <TableCell><StatusBadge tone="neutral">{item.qtype}</StatusBadge></TableCell>
                <TableCell className="capitalize">{item.difficulty || "medium"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.creator_id ? "Staff" : "Bank"}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Link href={href} className={adminIconButtonClass} aria-label={`Open question ${item.id}`}>
                    <MoreHorizontal aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AdminTablePagination
        id="questions"
        count={rows.length}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </section>
  );
}
