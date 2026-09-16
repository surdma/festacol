"use client";

import { useEffect, useMemo, useState } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function useAdminTablePagination<T>(rows: T[], initialPageSize = 15) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setPage(1);
  }

  return { page, pageSize, pageCount, pageRows, setPage, setPageSize };
}

export function AdminTablePagination({
  count,
  page,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  id = "admin-table",
}: {
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  id?: string;
}) {
  const first = count ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(count, page * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">{first}–{last} of {count}</span>
        <label htmlFor={`${id}-page-size`} className="flex items-center gap-2">
          Rows
          <NativeSelect
            id={`${id}-page-size`}
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 w-20"
          >
            {[10, 15, 25, 50].map((size) => (
              <NativeSelectOption key={size} value={String(size)}>{size}</NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>

      <Pagination className="mx-0 w-auto justify-start md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page === 1}
              tabIndex={page === 1 ? -1 : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 text-xs font-medium tabular-nums">Page {page} of {pageCount}</span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page === pageCount}
              tabIndex={page === pageCount ? -1 : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (page < pageCount) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
