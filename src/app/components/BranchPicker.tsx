import { Link } from 'react-router';
import { ArrowRight, Building2, Loader2 } from 'lucide-react';
import { useBranchStore } from '../hooks/useBranchStore';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

type Props = {
  title: string;
  description: string;
  actionLabel: string;
  basePath: string;
};

export function BranchPicker({ title, description, actionLabel, basePath }: Props) {
  const { branches, isLoading } = useBranchStore();
  const hasDescription = description.trim().length > 0;
  const showLoadingEmpty = isLoading && branches.length === 0;

  return (
    <div className="space-y-6">
      {/* Page header */}


      {showLoadingEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
          <Loader2 className="mb-4 size-9 animate-spin text-blue-500" aria-hidden />
          <p className="font-semibold text-slate-800">Loading branches…</p>
          <p className="mt-1.5 max-w-xs text-sm text-slate-500">Fetching branch list from the server.</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 ring-1 ring-blue-100">
            <Building2 className="size-7 text-blue-500" strokeWidth={1.8} />
          </div>
          <p className="font-semibold text-slate-800">No branches yet</p>
          <p className="mt-1.5 max-w-xs text-sm text-slate-500">
            Create your first branch under{' '}
            <strong className="text-slate-700">Branch Operations → Branches</strong> to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50/90 hover:bg-slate-50/90">
                <TableHead className="w-[22%] text-blue-950/70">Branch</TableHead>
                <TableHead className="min-w-0 text-blue-950/70">Address</TableHead>
                <TableHead className="w-[220px] text-right text-blue-950/70">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow
                  key={b.id}
                  className="border-b border-slate-100 transition-colors hover:bg-blue-50/30"
                >
                  <TableCell className="font-semibold text-foreground">{b.name}</TableCell>
                  <TableCell className="min-w-0 text-muted-foreground">{b.location}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button asChild size="sm" className="gap-1.5 text-[12.5px]">
                      <Link to={`/${basePath}/${b.id}`}>
                        {actionLabel}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
