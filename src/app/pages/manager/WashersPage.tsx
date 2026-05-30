import { useMemo, useState } from 'react';
import { useBranchStore } from '../../hooks/useBranchStore';
import { useManagerSession } from '../../hooks/useManagerSession';
import type { Washer } from '../../lib/branchStore';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { cn } from '../../components/ui/utils';

type SortKey = 'name_asc' | 'name_desc' | 'doj_asc' | 'doj_desc';
type StatusFilter = 'all' | 'active' | 'inactive';

const cardSurface = 'rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]';
const cell = 'align-middle px-4 py-3 text-sm [&:first-child]:pl-5 [&:last-child]:pr-5';

export default function WashersPage() {
  const { session } = useManagerSession();
  const { getData } = useBranchStore();
  const branchId = session?.branchId ?? '';
  const data = branchId ? getData(branchId) : null;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name_asc');

  const washers: Washer[] = data?.washers ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return washers
      .filter((w) => {
        if (statusFilter === 'active' && !w.active) return false;
        if (statusFilter === 'inactive' && w.active) return false;
        if (!q) return true;
        return (
          w.name.toLowerCase().includes(q) ||
          w.email.toLowerCase().includes(q) ||
          w.phone.toLowerCase().includes(q) ||
          w.loginId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'doj_asc') return (a.doj || '').localeCompare(b.doj || '');
        if (sortBy === 'doj_desc') return (b.doj || '').localeCompare(a.doj || '');
        return a.name.localeCompare(b.name);
      });
  }, [washers, search, statusFilter, sortBy]);

  if (!session) return null;

  return (
    <div className="min-w-0 space-y-4">
      <h1 className="select-none text-2xl font-bold tracking-tight text-foreground md:text-3xl">Washer detail</h1>

      <Card className={cn(cardSurface, 'overflow-hidden')}>
        <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-3 sm:px-6">
          {/* Filters row */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,320px)_140px_160px]">
            <Input
              type="search"
              placeholder="Search by name, email, phone…"
              className="h-9 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search washer detail"
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-sm shadow-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[300]">
                <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                <SelectItem value="active" className="text-xs">Active only</SelectItem>
                <SelectItem value="inactive" className="text-xs">Inactive only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-sm shadow-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[300]">
                <SelectItem value="name_asc" className="text-xs">Name (A–Z)</SelectItem>
                <SelectItem value="name_desc" className="text-xs">Name (Z–A)</SelectItem>
                <SelectItem value="doj_asc" className="text-xs">Joining date (oldest)</SelectItem>
                <SelectItem value="doj_desc" className="text-xs">Joining date (newest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {washers.length === 0
                ? 'No washers linked to this branch yet. Ask admin to add washers.'
                : 'No washers match your search or filter.'}
            </p>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <Table className="min-w-[560px] border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
                    <TableHead className={cn(cell, 'font-semibold text-foreground')}>Name</TableHead>
                    <TableHead className={cn(cell, 'font-semibold text-foreground')}>Email</TableHead>
                    <TableHead className={cn(cell, 'font-semibold text-foreground')}>Phone</TableHead>
                    <TableHead className={cn(cell, 'font-semibold text-foreground')}>Status</TableHead>
                    <TableHead className={cn(cell, 'font-semibold text-foreground')}>Joining date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w, i) => (
                    <TableRow
                      key={w.id}
                      className={cn(
                        'border-b border-slate-100 transition-colors hover:bg-slate-50/80',
                        i % 2 === 1 && 'bg-slate-50/40',
                      )}
                    >
                      <TableCell className={cn(cell, 'font-medium text-foreground')}>
                        {w.name?.trim() || w.loginId?.trim() || '—'}
                      </TableCell>
                      <TableCell className={cn(cell, 'break-all text-foreground')}>
                        {w.email?.trim() || '—'}
                      </TableCell>
                      <TableCell className={cn(cell, 'tabular-nums text-foreground')}>
                        {w.phone?.trim() || '—'}
                      </TableCell>
                      <TableCell className={cell}>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            w.active ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white',
                          )}
                        >
                          {w.active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className={cn(cell, 'tabular-nums text-foreground')}>
                        {w.doj?.trim() || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
