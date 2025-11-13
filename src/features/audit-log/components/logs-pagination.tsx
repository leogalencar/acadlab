"use client";

import { useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { PaginationState } from "@/features/shared/table";
import { PAGE_SIZE_OPTIONS } from "@/features/shared/table";

type LogsPaginationProps = {
  pagination: PaginationState;
};

export function LogsPagination({ pagination }: LogsPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const queryString = params.toString();
      return queryString ? `?${queryString}` : "";
    },
    [searchParams],
  );

  const handlePageChange = (page: number) => {
    router.push(`${pathname}${buildQuery({ page: page > 1 ? String(page) : null })}`);
  };

  const handlePerPageChange = (perPage: number) => {
    router.push(
      `${pathname}${buildQuery({
        perPage: perPage !== PAGE_SIZE_OPTIONS[0] ? String(perPage) : null,
        page: "1",
      })}`,
    );
  };

  const { page, perPage, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasResults = total > 0;
  const rangeStart = hasResults ? (page - 1) * perPage + 1 : 0;
  const rangeEnd = hasResults ? Math.min(total, page * perPage) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 text-sm md:flex-row md:items-center md:justify-between">
      <p className="text-muted-foreground">
        {hasResults
          ? `Exibindo ${rangeStart}-${rangeEnd} de ${total} registro${total === 1 ? "" : "s"}`
          : "Nenhum registro encontrado."}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-muted-foreground">
          Linhas por página
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
            value={perPage}
            onChange={(event) => handlePerPageChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {PAGE_SIZE_OPTIONS.includes(perPage) ? null : (
              <option value={perPage}>{perPage}</option>
            )}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {Math.min(page, totalPages)} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Próxima
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
