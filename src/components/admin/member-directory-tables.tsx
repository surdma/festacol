"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, ChevronRight, Eye, MoreHorizontal, Pencil, Trash2, UsersRound } from "lucide-react";
import { BulkHardDeleteDialog, type BulkDeleteMember } from "@/components/admin/bulk-hard-delete-dialog";
import { HardDeleteDialog } from "@/components/admin/hard-delete-dialog";
import { StudentStatusButton } from "@/components/admin/student-status-button";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DirectoryUserRow } from "@/lib/supabase/queries";
import type { StaffTeachingScope } from "@/lib/supabase/staff-directory";

export interface StudentDirectoryTableRow {
  user: DirectoryUserRow;
  className: string;
  classLevel: string;
  field: string;
  attempts: number;
  submitted: number;
  averageScore: number | null;
  averageIntegrity: number | null;
  placement: string | null;
  href: string;
}

export interface StaffDirectoryTableRow {
  user: DirectoryUserRow;
  teaching: StaffTeachingScope[];
}

function initials(name: string) {
  return name.split(/\s+/u).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "NA";
}

function readable(value: string | null | undefined, fallback = "Not recorded") {
  if (!value) return fallback;
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function useDirectoryPagination<T>(rows: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  return { page, pageSize, pageCount, pageRows, setPage, setPageSize };
}

function DirectoryFooter({
  count,
  page,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
}: {
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const first = count ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(count, page * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{first}–{last} of {count}</span>
        <label htmlFor={`page-size-${count}`} className="flex items-center gap-2">
          Rows
          <NativeSelect
            id={`page-size-${count}`}
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 w-20"
          >
            {[10, 15, 25, 50].map((size) => <NativeSelectOption key={size} value={String(size)}>{size}</NativeSelectOption>)}
          </NativeSelect>
        </label>
      </div>
      <Pagination className="mx-0 w-auto justify-start md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page === 1}
              onClick={(event) => { event.preventDefault(); if (page > 1) onPageChange(page - 1); }}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 text-xs font-medium tabular-nums">Page {page} of {pageCount}</span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page === pageCount}
              onClick={(event) => { event.preventDefault(); if (page < pageCount) onPageChange(page + 1); }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function SelectionToolbar({ count, label, onDelete, onClear }: { count: number; label: string; onDelete: () => void; onClear: () => void }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-foreground px-4 py-3 text-background">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UsersRound aria-hidden="true" />
        {count} {label}{count === 1 ? "" : "s"} selected
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background" onClick={onClear}>Clear</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 data-icon="inline-start" />Delete selected
        </Button>
      </div>
    </div>
  );
}

export function StudentDirectoryTable({ rows, canDelete }: { rows: StudentDirectoryTableRow[]; canDelete: boolean }) {
  const router = useRouter();
  const { page, pageSize, pageCount, pageRows, setPage, setPageSize } = useDirectoryPagination(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<StudentDirectoryTableRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const visible = new Set(rows.map((row) => row.user.id));
    setSelected((current) => new Set([...current].filter((id) => visible.has(id))));
  }, [rows]);

  const currentPageIds = pageRows.map((row) => row.user.id);
  const allCurrentSelected = canDelete && currentPageIds.length > 0 && currentPageIds.every((id) => selected.has(id));
  const selectedRows = rows.filter((row) => selected.has(row.user.id));
  const selectedMembers: BulkDeleteMember[] = selectedRows.map((row) => ({
    id: row.user.id,
    name: row.user.full_name,
    identifier: row.user.student_number,
    role: "student",
  }));

  function toggleAllCurrent(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of currentPageIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function openEdit(studentId: string) {
    router.push(`/workspace/students?modal=user-edit&student=${encodeURIComponent(studentId)}`);
  }

  function afterDelete() {
    setSelected(new Set());
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-xs">
      <SelectionToolbar count={selected.size} label="student" onDelete={() => setBulkOpen(true)} onClear={() => setSelected(new Set())} />

      <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              {canDelete ? <TableHead className="w-10 pl-4"><Checkbox aria-label="Select students on this page" checked={allCurrentSelected} onCheckedChange={(checked) => toggleAllCurrent(Boolean(checked))} /></TableHead> : null}
              <TableHead className="min-w-56">Student</TableHead>
              <TableHead className="min-w-52">Academic placement</TableHead>
              <TableHead className="min-w-52">Guardian / contact</TableHead>
              <TableHead className="min-w-44">Results snapshot</TableHead>
              <TableHead className="min-w-36">Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => {
              const { user } = row;
              return (
                <TableRow key={user.id} data-state={selected.has(user.id) ? "selected" : undefined}>
                  {canDelete ? <TableCell className="pl-4"><Checkbox aria-label={`Select ${user.full_name}`} checked={selected.has(user.id)} onCheckedChange={(checked) => toggleOne(user.id, Boolean(checked))} /></TableCell> : null}
                  <TableCell>
                    <button type="button" onClick={() => router.push(row.href)} className="flex max-w-64 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Avatar size="lg"><AvatarFallback className="font-semibold">{initials(user.full_name)}</AvatarFallback></Avatar>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">{user.full_name}</strong>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{user.student_number || user.id}</span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <strong className="block text-sm">{row.className}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">{row.classLevel ? `${row.classLevel} · ${row.field}` : "No current class"}</span>
                    <span className="mt-1 block text-xs">Placement: {readable(row.placement, "Pending")}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-sm">{user.guardian || "Guardian not recorded"}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{user.phone || "Phone not recorded"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <strong className="text-base tabular-nums">{row.averageScore === null ? "—" : `${row.averageScore}%`}</strong>
                      {row.averageIntegrity !== null ? <StatusBadge tone={row.averageIntegrity >= 80 ? "emerald" : "amber"}>Integrity {row.averageIntegrity}%</StatusBadge> : null}
                    </div>
                    <span className="mt-1 block text-xs text-muted-foreground">{row.submitted}/{row.attempts} submitted attempts</span>
                  </TableCell>
                  <TableCell><span className="text-sm">{readable(user.promotion_status)}</span></TableCell>
                  <TableCell><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></TableCell>
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={`Actions for ${user.full_name}`} />}><MoreHorizontal /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Student actions</DropdownMenuLabel>
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => router.push(row.href)}><Eye />Preview record</DropdownMenuItem>
                          {canDelete ? <DropdownMenuItem onClick={() => openEdit(user.id)}><Pencil />Edit student</DropdownMenuItem> : null}
                        </DropdownMenuGroup>
                        <DropdownMenuGroup>
                          <div className="px-1.5 py-1"><StudentStatusButton studentId={user.id} name={user.full_name} active={user.status === "active"} compact /></div>
                          {canDelete ? <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}><Trash2 />Delete student</DropdownMenuItem> : null}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ItemGroup className="gap-0 divide-y md:hidden">
        {pageRows.map((row) => {
          const { user } = row;
          return (
            <Item key={user.id} variant="default" className="rounded-none border-0 px-4 py-4">
              {canDelete ? <Checkbox aria-label={`Select ${user.full_name}`} checked={selected.has(user.id)} onCheckedChange={(checked) => toggleOne(user.id, Boolean(checked))} /> : null}
              <ItemMedia><Avatar size="lg"><AvatarFallback className="font-semibold">{initials(user.full_name)}</AvatarFallback></Avatar></ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>{user.full_name}<StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></ItemTitle>
                <ItemDescription>{row.className} · {row.field} · {row.averageScore === null ? "No submitted result" : `${row.averageScore}% average`}</ItemDescription>
                <p className="font-mono text-[11px] text-muted-foreground">{user.student_number || user.id}</p>
              </ItemContent>
              <ItemActions>
                <Button size="icon" variant="ghost" onClick={() => router.push(row.href)} aria-label={`Open ${user.full_name}`}><ChevronRight /></Button>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>

      <DirectoryFooter count={rows.length} page={page} pageSize={pageSize} pageCount={pageCount} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />

      <HardDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        memberId={deleteTarget?.user.id}
        memberName={deleteTarget?.user.full_name}
        memberStudentNumber={deleteTarget?.user.student_number}
        onDeleted={afterDelete}
      />
      <BulkHardDeleteDialog open={bulkOpen} onOpenChange={setBulkOpen} members={selectedMembers} onDeleted={afterDelete} />
    </section>
  );
}

export function StaffDirectoryTable({ rows, canDelete }: { rows: StaffDirectoryTableRow[]; canDelete: boolean }) {
  const router = useRouter();
  const { page, pageSize, pageCount, pageRows, setPage, setPageSize } = useDirectoryPagination(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<StaffDirectoryTableRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const currentPageIds = pageRows.map((row) => row.user.id);
  const allCurrentSelected = canDelete && currentPageIds.length > 0 && currentPageIds.every((id) => selected.has(id));
  const selectedRows = rows.filter((row) => selected.has(row.user.id));
  const selectedMembers: BulkDeleteMember[] = selectedRows.map((row) => ({
    id: row.user.id,
    name: row.user.full_name,
    identifier: row.user.staff_number,
    role: row.user.role === "administrator" ? "administrator" : "teacher",
  }));

  function toggleAllCurrent(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of currentPageIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function manageStaff(id: string) {
    router.push(`/workspace/staff?modal=staff-edit&staff=${encodeURIComponent(id)}`);
  }

  function afterDelete() {
    setSelected(new Set());
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-xs">
      <SelectionToolbar count={selected.size} label="staff member" onDelete={() => setBulkOpen(true)} onClear={() => setSelected(new Set())} />

      <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              {canDelete ? <TableHead className="w-10 pl-4"><Checkbox aria-label="Select staff on this page" checked={allCurrentSelected} onCheckedChange={(checked) => toggleAllCurrent(Boolean(checked))} /></TableHead> : null}
              <TableHead className="min-w-56">Staff member</TableHead>
              <TableHead className="min-w-36">Role</TableHead>
              <TableHead className="min-w-56">Qualifications</TableHead>
              <TableHead className="min-w-72">Teaching assignments</TableHead>
              <TableHead className="min-w-36">Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => {
              const { user, teaching } = row;
              const visibleTeaching = teaching.slice(0, 3);
              return (
                <TableRow key={user.id} data-state={selected.has(user.id) ? "selected" : undefined}>
                  {canDelete ? <TableCell className="pl-4"><Checkbox aria-label={`Select ${user.full_name}`} checked={selected.has(user.id)} onCheckedChange={(checked) => toggleOne(user.id, Boolean(checked))} /></TableCell> : null}
                  <TableCell>
                    <div className="flex max-w-64 items-center gap-3">
                      <Avatar size="lg"><AvatarFallback className="font-semibold">{initials(user.full_name)}</AvatarFallback></Avatar>
                      <span className="min-w-0"><strong className="block truncate text-sm">{user.full_name}</strong><span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{user.staff_number || user.id}</span></span>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge tone={user.role === "administrator" ? "blue" : "neutral"}>{readable(user.role)}</StatusBadge></TableCell>
                  <TableCell>
                    <span className="block max-w-64 whitespace-normal text-sm">{user.role === "administrator" ? "Administrator scope" : user.subjects.length ? user.subjects.join(", ") : "No subject qualification"}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{user.subjects.length} qualified subject{user.subjects.length === 1 ? "" : "s"}</span>
                  </TableCell>
                  <TableCell>
                    {user.role === "administrator" ? <span className="text-sm text-muted-foreground">School-wide administration</span> : teaching.length ? (
                      <div className="flex max-w-80 flex-wrap gap-1.5 whitespace-normal">
                        {visibleTeaching.map((scope) => <StatusBadge key={scope.offeringId} tone="neutral">{scope.subjectName} · {scope.className}</StatusBadge>)}
                        {teaching.length > visibleTeaching.length ? <StatusBadge tone="neutral">+{teaching.length - visibleTeaching.length} more</StatusBadge> : null}
                      </div>
                    ) : <span className="text-sm text-muted-foreground">No active class assignment</span>}
                  </TableCell>
                  <TableCell>{user.qualifier_access ? <StatusBadge tone="blue">Placement access</StatusBadge> : <span className="text-sm text-muted-foreground">Standard</span>}</TableCell>
                  <TableCell><StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></TableCell>
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={`Actions for ${user.full_name}`} />}><MoreHorizontal /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Staff actions</DropdownMenuLabel>
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => manageStaff(user.id)}><Pencil />Manage scope</DropdownMenuItem>
                          {teaching.length ? <DropdownMenuItem onClick={() => manageStaff(user.id)}><BookOpenCheck />Teaching assignments</DropdownMenuItem> : null}
                          {canDelete ? <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}><Trash2 />Delete account</DropdownMenuItem> : null}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ItemGroup className="gap-0 divide-y md:hidden">
        {pageRows.map((row) => {
          const { user, teaching } = row;
          return (
            <Item key={user.id} className="rounded-none border-0 px-4 py-4">
              {canDelete ? <Checkbox aria-label={`Select ${user.full_name}`} checked={selected.has(user.id)} onCheckedChange={(checked) => toggleOne(user.id, Boolean(checked))} /> : null}
              <ItemMedia><Avatar size="lg"><AvatarFallback className="font-semibold">{initials(user.full_name)}</AvatarFallback></Avatar></ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>{user.full_name}<StatusBadge tone={user.status === "active" ? "emerald" : "neutral"}>{user.status}</StatusBadge></ItemTitle>
                <ItemDescription>{readable(user.role)} · {teaching.length} active teaching assignment{teaching.length === 1 ? "" : "s"}</ItemDescription>
                <p className="font-mono text-[11px] text-muted-foreground">{user.staff_number || user.id}</p>
              </ItemContent>
              <ItemActions><Button size="icon" variant="ghost" onClick={() => manageStaff(user.id)} aria-label={`Manage ${user.full_name}`}><ChevronRight /></Button></ItemActions>
            </Item>
          );
        })}
      </ItemGroup>

      <DirectoryFooter count={rows.length} page={page} pageSize={pageSize} pageCount={pageCount} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />

      <HardDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        memberId={deleteTarget?.user.id}
        memberName={deleteTarget?.user.full_name}
        memberStudentNumber={deleteTarget?.user.staff_number}
        onDeleted={afterDelete}
      />
      <BulkHardDeleteDialog open={bulkOpen} onOpenChange={setBulkOpen} members={selectedMembers} onDeleted={afterDelete} />
    </section>
  );
}
