import { useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { CalendarDays, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { useBranchStore } from '../../hooks/useBranchStore';
import {
  buildBranchBookingStatusPatch,
  patchBranchManagerBooking,
} from '../../lib/branchApi';
import { useManagerSession } from '../../hooks/useManagerSession';
import type { BookingJobStatus, BranchBookingJob } from '../../lib/branchStore';
import { canManagerPortalEditBookingJob, todayLocalISO } from '../../lib/managerPortalUtils';
import { EditBranchBookingDialog } from '../../components/manager/EditBranchBookingDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

/** Normalise an Australian mobile number to +61 display format. */
function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '—';
  const s = raw.trim();
  if (!s) return '—';
  if (s.startsWith('+')) return s.replace(/^\+61(\d)/, '+61-$1');
  const digits = s.replace(/\D/g, '');
  // 10-digit Australian number starting with 0 → replace leading 0 with +61
  if (digits.length === 10 && digits.startsWith('0')) return `+61-${digits.slice(1)}`;
  // 9-digit (already stripped leading 0)
  if (digits.length === 9) return `+61-${digits}`;
  return s;
}

/** Map raw status to the manager-visible values; collapse washer-only `checked_in` / `arrived` to `in_progress`. */
function viewBookingsStatusSelectValue(status: BookingJobStatus): 'scheduled' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'in_progress' || status === 'checked_in') return 'in_progress';
  if (status === 'assigned') return 'assigned';
  return 'scheduled';
}

type AllowedTransition = { value: BookingJobStatus; label: string };

const STATUS_DISPLAY_LABEL: Record<string, string> = {
  scheduled:   'Scheduled',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

/** Forward-only transitions available from a given current status. */
function getAllowedTransitions(status: BookingJobStatus): AllowedTransition[] {
  const mapped = viewBookingsStatusSelectValue(status);
  switch (mapped) {
    case 'scheduled':   return [{ value: 'assigned', label: 'Assigned' }, { value: 'cancelled', label: 'Cancelled' }];
    case 'assigned':    return [{ value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }];
    case 'in_progress': return [{ value: 'completed', label: 'Completed' }];
    default:            return [];
  }
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const cardSurface =
  'rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]';

function DateFilterPopover({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (isoDate: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const display = value ? format(selected, 'MMM d, yyyy') : 'Select date';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 min-w-0 justify-between rounded-lg border-slate-200 bg-white px-2.5 text-left text-xs font-medium shadow-sm sm:w-[10.5rem]"
          title={label}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-3.5 text-blue-600" />
            <span className="truncate">{display}</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" sideOffset={6} className="z-[300] w-auto border-slate-200 p-1.5">
        <Calendar
          mode="single"
          selected={selected}
          className="p-1.5"
          onSelect={(d) => {
            if (!d) return;
            onChange(format(d, 'yyyy-MM-dd'));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function ViewBookingsPage() {
  const { session } = useManagerSession();
  const { branches, getData, updateBranchData, isLoading, refresh } = useBranchStore();
  const branchId = session?.branchId ?? '';
  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const today = todayLocalISO();
  const [fromDate, setFromDate] = useState(() => addDays(today, -30));
  const [toDate, setToDate] = useState(() => addDays(today, 90));
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterService, setFilterService] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [editJob, setEditJob] = useState<BranchBookingJob | null>(null);
  const [requireWasherAssign, setRequireWasherAssign] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const washersById = useMemo(
    () => Object.fromEntries((data?.washers ?? []).map((w) => [w.id, w.name || w.loginId])),
    [data?.washers]
  );

  const filtered = useMemo(() => {
    const nameQ = filterName.trim().toLowerCase();
    const phoneQ = filterPhone.trim().toLowerCase();
    const serviceQ = filterService.trim().toLowerCase();

    return (data?.branchBookings ?? [])
      .filter((j) => {
        if (j.slotDate < fromDate || j.slotDate > toDate) return false;
        if (nameQ && !j.customerName.toLowerCase().includes(nameQ)) return false;
        if (phoneQ && !(j.phone || '').toLowerCase().includes(phoneQ)) return false;
        if (serviceQ && !(j.serviceSummary || '').toLowerCase().includes(serviceQ)) return false;
        if (statusFilter !== 'all' && viewBookingsStatusSelectValue(j.status) !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.customerName.localeCompare(b.customerName);
        if (sortBy === 'name_desc') return b.customerName.localeCompare(a.customerName);
        if (sortBy === 'date_asc') {
          const d = a.slotDate.localeCompare(b.slotDate);
          return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
        }
        if (sortBy === 'created_desc') return b.createdAt.localeCompare(a.createdAt);
        if (sortBy === 'created_asc') return a.createdAt.localeCompare(b.createdAt);
        // date_desc (default): newest service date first, then time
        const d = b.slotDate.localeCompare(a.slotDate);
        return d !== 0 ? d : b.startTime.localeCompare(a.startTime);
      });
  }, [data?.branchBookings, fromDate, toDate, filterName, filterPhone, filterService, sortBy, statusFilter]);

  if (!session) {
    return null;
  }

  if (isLoading && !branch) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          <Loader2 className="size-4 animate-spin text-blue-600" />
          Loading bookings...
        </div>
      </div>
    );
  }

  if (!branch || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Unable to load booking data for this branch.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">View bookings</h1>
      </header>

      <Card className={cn(cardSurface, 'overflow-hidden')}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Bookings</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {filtered.length} job{filtered.length === 1 ? '' : 's'} shown.
                </CardDescription>
              </div>

              {/* ── status filter chips ── */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 flex-1 min-w-0">
                {(
                  [
                    { value: 'all',         label: 'All' },
                    { value: 'scheduled',   label: 'Scheduled' },
                    { value: 'assigned',    label: 'Assigned' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'completed',   label: 'Completed' },
                    { value: 'cancelled',   label: 'Cancelled' },
                  ] as const
                ).map(({ value, label }) => {
                  const active = statusFilter === value;
                  const colorMap: Record<string, string> = {
                    all:         active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600',
                    scheduled:   active ? 'bg-slate-700 text-white border-slate-700 shadow-sm'   : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                    assigned:    active ? 'bg-sky-600 text-white border-sky-600 shadow-sm'       : 'bg-white text-sky-700 border-sky-200 hover:border-sky-400',
                    in_progress: active ? 'bg-amber-500 text-white border-amber-500 shadow-sm'   : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400',
                    completed:   active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400',
                    cancelled:   active ? 'bg-rose-600 text-white border-rose-600 shadow-sm'     : 'bg-white text-rose-600 border-rose-200 hover:border-rose-400',
                  };
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-all duration-150',
                        colorMap[value],
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 w-52 rounded-lg border-slate-200 bg-white text-xs shadow-sm" aria-label="Sort bookings">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[300] min-w-[13rem]">
                    <SelectItem value="date_desc" className="text-xs">Service Date (Newest first)</SelectItem>
                    <SelectItem value="date_asc" className="text-xs">Service Date (Oldest first)</SelectItem>
                    <SelectItem value="created_desc" className="text-xs">Booking Created (Newest first)</SelectItem>
                    <SelectItem value="created_asc" className="text-xs">Booking Created (Oldest first)</SelectItem>
                    <SelectItem value="name_asc" className="text-xs">Name (A–Z)</SelectItem>
                    <SelectItem value="name_desc" className="text-xs">Name (Z–A)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={refreshing}
                  onClick={async () => {
                    setRefreshing(true);
                    try { await refresh(); } finally { setRefreshing(false); }
                  }}
                  className="h-8 gap-1.5 text-xs shrink-0"
                  title="Refresh bookings"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {/* Date range */}
                <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <Label htmlFor="vb-from" className="sr-only">From date</Label>
                  <div id="vb-from"><DateFilterPopover value={fromDate} onChange={setFromDate} label="From date" /></div>
                  <span className="shrink-0 text-muted-foreground" aria-hidden>–</span>
                  <Label htmlFor="vb-to" className="sr-only">To date</Label>
                  <div id="vb-to"><DateFilterPopover value={toDate} onChange={setToDate} label="To date" /></div>
                </div>

                {/* Customer name */}
                <Input
                  type="search"
                  placeholder="Customer name"
                  className="h-9 w-40 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  aria-label="Filter by customer name"
                />

                {/* Phone */}
                <Input
                  type="search"
                  placeholder="Phone"
                  className="h-9 w-32 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
                  value={filterPhone}
                  onChange={(e) => setFilterPhone(e.target.value)}
                  aria-label="Filter by phone"
                />

                {/* Service */}
                <Input
                  type="search"
                  placeholder="Service"
                  className="h-9 w-36 rounded-lg border-slate-200 bg-white text-sm shadow-sm"
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                  aria-label="Filter by service"
                />

              </div>
            </div>
            {statusError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {statusError}
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No bookings match.</p>
          ) : (
            <div className="max-h-[min(72vh,720px)] overflow-auto">
              <table className="w-full table-fixed caption-bottom border-collapse text-sm">
                <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/98 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-sm [&_tr]:border-b">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="h-11 w-[130px] px-3 py-3">Booking ID</TableHead>
                    <TableHead className="h-11 w-[120px] px-3 py-3">Customer</TableHead>
                    <TableHead className="h-11 w-[120px] px-3 py-3">Date & time</TableHead>
                    <TableHead className="h-11 px-3 py-3">Service</TableHead>
                    <TableHead className="h-11 w-[155px] px-3 py-3">Phone</TableHead>
                    <TableHead className="h-11 w-[100px] px-3 py-3">Booking date</TableHead>
                    <TableHead className="h-11 w-[130px] px-3 py-3 text-center">Status</TableHead>
                    <TableHead className="h-11 w-[120px] px-3 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((j, i) => (
                    <TableRow
                      key={j.id}
                      className={cn(
                        'border-b border-slate-100 transition-colors hover:bg-slate-50/80',
                        i % 2 === 1 && 'bg-slate-50/40',
                      )}
                    >
                      <TableCell className="whitespace-nowrap px-3 py-2 font-mono text-sm font-semibold">
                        {(() => {
                          const hex = j.id.replace(/-/g, '').slice(-6).toUpperCase();
                          if (j.customerId) {
                            return `${hex}-${j.customerId.replace(/-/g, '').slice(-4).toUpperCase()}`;
                          }
                          if (j.phone) {
                            const digits = j.phone.replace(/\D/g, '');
                            if (digits) {
                              const num = parseInt(digits.slice(-9), 10);
                              const suffix = num.toString(36).toUpperCase().slice(-4).padStart(4, '0');
                              return `${hex}-${suffix}`;
                            }
                          }
                          return hex;
                        })()}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm font-medium">{j.customerName}</TableCell>
                      <TableCell className="px-3 py-2 tabular-nums text-sm">
                        <div className="flex flex-col leading-tight">
                          <span className="font-medium">{format(parse(j.slotDate, 'yyyy-MM-dd', new Date()), 'd MMM yy')}</span>
                          <span className="text-xs">{j.startTime}–{j.endTime}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm font-medium leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
                        {j.serviceSummary
                          ?.replace(/\s*\(.*?\)\s*$/, '')
                          .replace(/\s*\$\d+(\.\d+)?\s*/g, ' ')
                          .split('+')
                          .map((p) => p.trim())
                          .filter(Boolean)
                          .join(' + ')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2 text-sm font-medium">{formatPhone(j.phone)}</TableCell>
                      <TableCell className="px-3 py-2 tabular-nums text-sm font-medium">
                        {j.createdAt
                          ? format(new Date(j.createdAt), 'd MMM yy')
                          : '—'}
                      </TableCell>
                      <TableCell className="px-3 py-2 align-middle">
                        {j.status === 'completed' || j.status === 'cancelled' ? (
                          <span
                            className={cn(
                              'inline-flex h-8 w-full items-center rounded-md border px-3 text-xs font-medium capitalize',
                              j.status === 'completed'
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700',
                            )}
                          >
                            {j.status}
                          </span>
                        ) : (
                          <Select
                            value={viewBookingsStatusSelectValue(j.status)}
                            onValueChange={async (v) => {
                              setStatusError('');
                              const next = v as BookingJobStatus;
                              // Intercept "assigned" when no washer is yet assigned — open Manage instead
                              if (next === 'assigned' && !j.assignedWasherId) {
                                setRequireWasherAssign(true);
                                setEditJob(j);
                                return;
                              }
                              setStatusSavingId(j.id);
                              try {
                                await patchBranchManagerBooking(
                                  j.id,
                                  buildBranchBookingStatusPatch(j, next)
                                );
                                await refresh();
                              } catch (error) {
                                setStatusError(
                                  error instanceof Error && error.message
                                    ? error.message
                                    : 'Failed to persist booking status. Please try again.'
                                );
                              } finally {
                                setStatusSavingId(null);
                              }
                            }}
                          >
                            <SelectTrigger
                              className={cn(
                                'h-8 w-full text-xs shadow-sm font-medium',
                                viewBookingsStatusSelectValue(j.status) === 'in_progress'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : viewBookingsStatusSelectValue(j.status) === 'assigned'
                                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                                    : 'border-slate-200 bg-white text-slate-700',
                              )}
                              disabled={statusSavingId === j.id}
                            >
                              <SelectValue>
                                <span>{STATUS_DISPLAY_LABEL[viewBookingsStatusSelectValue(j.status)]}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[300]">
                              {getAllowedTransitions(j.status).map((o) => (
                                <SelectItem key={o.value} value={o.value} className={cn(
                                  'text-xs capitalize font-medium',
                                  o.value === 'completed' ? 'text-green-700' : o.value === 'cancelled' ? 'text-rose-700' : o.value === 'in_progress' ? 'text-amber-800' : o.value === 'assigned' ? 'text-sky-700' : '',
                                )}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        {(() => {
                          const mappedSt = viewBookingsStatusSelectValue(j.status);
                          const isViewOnlyStatus = mappedSt === 'in_progress' || mappedSt === 'completed' || mappedSt === 'cancelled';
                          const canEdit = canManagerPortalEditBookingJob(j, today);
                          const isDisabled = !isViewOnlyStatus && !canEdit;
                          return (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={isDisabled}
                              title={
                                isDisabled
                                  ? j.slotDate < today
                                    ? 'Past-dated bookings cannot be edited.'
                                    : 'Only active bookings (not completed or cancelled) can be edited.'
                                  : undefined
                              }
                              onClick={() => { setRequireWasherAssign(false); setEditJob(j); }}
                            >
                              {isViewOnlyStatus ? 'View' : 'Manage'}
                            </Button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {branch && data ? (
        <EditBranchBookingDialog
          open={!!editJob}
          onOpenChange={(o) => {
            if (!o) { setEditJob(null); setRequireWasherAssign(false); }
          }}
          job={editJob}
          branchId={branchId}
          branch={branch}
          data={data}
          updateBranchData={updateBranchData}
          requireWasherAssign={requireWasherAssign}
        />
      ) : null}
    </div>
  );
}
