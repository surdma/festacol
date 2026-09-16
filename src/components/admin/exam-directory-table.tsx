"use client";

import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { AdminTablePagination, useAdminTablePagination } from "@/components/admin/admin-table-pagination";
import { AdminEmptyState, adminIconButtonClass } from "@/components/admin/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ExamDirectoryTableRow {
  id: string;
  title: string;
  targetLabels: string[];
  subjectNames: string[];
  mode: string;
  state: string;
  attempts: number;
  submitted: number;
}

export function ExamDirectoryTable({ rows }: { rows: ExamDirectoryTableRow[] }) {
  const { page, pageSize, pageCount, pageRows, setPage, setPageSize } = useAdminTablePagination(rows, 15);

  if (!rows.length) {
    return <AdminEmptyState title="No matching examinations" description="Change the current search or status filters to see other examination sessions." />;
  }

  return (
    <>
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="min-w-64">Exam</TableHead>
            <TableHead className="min-w-64">Audience / subjects</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-14"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-normal">
                <strong className="block text-foreground">{row.title}</strong>
                <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{row.id}</span>
              </TableCell>
              <TableCell className="whitespace-normal">
                <span className="block text-xs font-semibold text-foreground">{row.targetLabels.join(", ") || "Explicit student audience"}</span>
                <span className="mt-1 block max-w-xs text-xs text-muted-foreground">{row.subjectNames.length ? row.subjectNames.join(", ") : row.mode}</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.submitted}/{row.attempts} submitted</TableCell>
              <TableCell>
                <StatusBadge tone={row.state === "open" ? "emerald" : row.state === "scheduled" ? "blue" : row.state === "draft" ? "amber" : "neutral"}>
                  {row.state}
                </StatusBadge>
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Link
                  href={`/workspace/exams?modal=exam&exam=${encodeURIComponent(row.id)}`}
                  className={adminIconButtonClass}
                  aria-label={`Open ${row.title}`}
                >
                  <BookOpenCheck aria-hidden="true" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AdminTablePagination
        id="examinations"
        count={rows.length}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}
