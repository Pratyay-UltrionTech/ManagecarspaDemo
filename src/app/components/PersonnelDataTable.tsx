import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { cn } from './ui/utils';

export type PersonnelColumn = {
  key: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string;
};

type Props = {
  columns: PersonnelColumn[];
  children: ReactNode;
  /** When false, only the table is rendered (no outer card border) — use inside a parent container. */
  framed?: boolean;
  /** Applied to the inner `<table>` (e.g. `table-fixed` so long cell text respects column bounds). */
  tableClassName?: string;
};

/** Matches services table styling: neutral header row, roomy cells, actions column right-aligned. */
export function PersonnelDataTable({ columns, children, framed = true, tableClassName }: Props) {
  const table = (
    <Table className={cn('w-full min-w-[880px]', tableClassName)}>
      <TableHeader>
        <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600',
                col.headerClassName
              )}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );

  if (!framed) {
    return <div className="overflow-x-auto bg-card">{table}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-card shadow-sm">
      {table}
    </div>
  );
}

export function PersonnelTableEmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="px-6 py-12 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

export function PersonnelTableRow({ children }: { children: ReactNode }) {
  return (
    <TableRow className="border-b border-slate-100 transition-colors hover:bg-slate-50">{children}</TableRow>
  );
}
