import { useMemo, useState, useCallback } from 'react';
import { format, parse } from 'date-fns';
import { CalendarDays, ChevronDown, RefreshCw } from 'lucide-react';
import { useMobileManagerSession } from '../../../hooks/useMobileManagerSession';
import { useMobileServicesStore } from '../../../hooks/useMobileServicesStore';
import {
  buildMobileBookingStatusPatch,
  patchMobileManagerBooking,
} from '../../../lib/mobileApi';
import {
  getMobileOpsForPin,
  isValidPinCode,
  normalizePinCode,
  type MobileManagerJob,
  type MobileManagerJobStatus,
  normalizeMobileManagerJobStatus,
} from '../../../lib/mobileServicesStore';
import { canManagerPortalEditBookingJob, todayLocalISO } from '../../../lib/managerPortalUtils';
import { EditMobileBookingDialog } from '../../../components/manager/EditMobileBookingDialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Calendar } from '../../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { cn } from '../../../components/ui/utils';

const cardSurface =
  'rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]';

function statusMeta(status: MobileManagerJobStatus): { label: string; className: string } {
  switch (status) {
    case 'assigned':
      return { label: 'Assigned', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'arrived':
    case 'checked_in':
      return { label: 'Arrived', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'in_progress':
      return { label: 'In Progress', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'completed':
      return { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-red-50 text-red-600 border-red-200' };
    default:
      return { label: 'Scheduled', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
}

type FilterStatus = 'all' | MobileManagerJobStatus;
type BookingsSortBy = 'created_new' | 'created_old' | 'date_new' | 'date_old' | 'name_asc' | 'name_desc';

type AllowedTransition = { value: MobileManagerJobStatus; label: string };

function getAllowedTransitions(status: MobileManagerJobStatus): AllowedTransition[] {
  const s = status === 'checked_in' ? 'arrived' : status;
  switch (s) {
    case 'scheduled':
      return [
        { value: 'assigned', label: 'Assigned' },
        { value: 'cancelled', label: 'Cancelled' },
      ];
    case 'assigned':
      return [
        { value: 'arrived', label: 'Arrived' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ];
    case 'arrived':
      return [
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ];
    case 'in_progress':
      return [{ value: 'completed', label: 'Completed' }];
    default:
      return [];
  }
}

function bookingRecordedAtMs(job: MobileManagerJob): number {
  const raw = job.createdAt?.trim();
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

function bookingScheduledInstantMs(job: MobileManagerJob): number | null {
  if (!job.slotDate) return null;
  let t = (job.startTime || '').trim();
  if (!t) t = '00:00';
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [hh, mm] = t.split(':');
    t = `${hh!.padStart(2, '0')}:${mm!.padStart(2, '0')}:00`;
  } else if (!/^\d{1,2}:\d{2}:\d{2}/.test(t)) {
    return null;
  }
  const ms = Date.parse(`${job.slotDate}T${t.slice(0, 8)}`);
  return Number.isNaN(ms) ? null : ms;
}

function compareSlotDesc(a: MobileManagerJob, b: MobileManagerJob): number {
  const d = b.slotDate.localeCompare(a.slotDate);
  if (d !== 0) return d;
  return b.startTime.localeCompare(a.startTime);
}

function compareSlotAsc(a: MobileManagerJob, b: MobileManagerJob): number {
  const d = a.slotDate.localeCompare(b.slotDate);
  if (d !== 0) return d;
  return a.startTime.localeCompare(b.startTime);
}

function compareBookings(a: MobileManagerJob, b: MobileManagerJob, sortBy: BookingsSortBy): number {
  switch (sortBy) {
    case 'created_new': {
      const c = bookingRecordedAtMs(b) - bookingRecordedAtMs(a);
      if (c !== 0) return c;
      return compareSlotDesc(a, b);
    }
    case 'created_old': {
      const c = bookingRecordedAtMs(a) - bookingRecordedAtMs(b);
      if (c !== 0) return c;
      return compareSlotAsc(a, b);
    }
    case 'date_new': {
      const ma = bookingScheduledInstantMs(a);
      const mb = bookingScheduledInstantMs(b);
      if (ma !== null && mb !== null && ma !== mb) return mb - ma;
      return compareSlotDesc(a, b);
    }
    case 'date_old': {
      const ma = bookingScheduledInstantMs(a);
      const mb = bookingScheduledInstantMs(b);
      if (ma !== null && mb !== null && ma !== mb) return ma - mb;
      return compareSlotAsc(a, b);
    }
    case 'name_asc': {
      const n = (a.customerName || '').localeCompare(b.customerName || '', undefined, { sensitivity: 'base' });
      if (n !== 0) return n;
      return compareSlotAsc(a, b);
    }
    case 'name_desc': {
      const n = (b.customerName || '').localeCompare(a.customerName || '', undefined, { sensitivity: 'base' });
      if (n !== 0) return n;
      return compareSlotAsc(a, b);
    }
    default:
      return 0;
  }
}

function toSelectStatus(s: MobileManagerJobStatus): MobileManagerJobStatus {
  return s === 'checked_in' ? 'arrived' : s;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '—';
  const s = raw.trim();
  if (!s) return '—';
  if (s.startsWith('+')) return s.replace(/^\+61(\d)/, '+61-$1');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+61-${digits.slice(1)}`;
  if (digits.length === 9) return `+61-${digits}`;
  return s;
}

function shortId(id: string, customerId?: string | null, phone?: string): string {
  const hex = id.replace(/-/g, '').slice(-6).toUpperCase();
  if (customerId) {
    return `${hex}-${customerId.replace(/-/g, '').slice(-4).toUpperCase()}`;
  }
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits) {
      const num = parseInt(digits.slice(-9), 10);
      return `${hex}-${num.toString(36).toUpperCase().slice(-4).padStart(4, '0')}`;
    }
  }
  return hex;
}

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
  const display = value ? format(selected!, 'MMM d, yyyy') : 'Select date';

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

function formatJobServiceDisplay(
  job: MobileManagerJob,
  serviceNameById: Map<string, string>,
  addonNameById: Map<string, string>,
): string {
  const serviceName =
    (job.serviceId ? serviceNameById.get(job.serviceId) : undefined) ||
    job.vehicleSummary?.trim() ||
    '';
  const addonNames = (job.selectedAddonIds ?? [])
    .map((id) => addonNameById.get(id)?.trim())
    .filter((n): n is string => Boolean(n));
  if (!serviceName && addonNames.length === 0) return '—';
  if (addonNames.length === 0) return serviceName;
  if (!serviceName) return addonNames.join(', ');
  return `${serviceName} + ${addonNames.join(', ')}`;
}

const STATUS_FILTER_CHIPS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function MobileViewBookingsPage() {
  const { session } = useMobileManagerSession();
  const { state, staff, updateMobileOpsForPin, updateMobileOpsForPinAsync, reloadFromApi } =
    useMobileServicesStore();
  const pin = session?.cityPinCode ? normalizePinCode(session.cityPinCode) : '';
  const ops = useMemo(() => (pin ? getMobileOpsForPin(state, pin) : null), [state, pin]);

  const today = todayLocalISO();
  const [fromDate, setFromDate] = useState(() => addDays(today, -30));
  const [toDate, setToDate] = useState(() => addDays(today, 90));
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<BookingsSortBy>('created_new');
  const [editJob, setEditJob] = useState<MobileManagerJob | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await reloadFromApi();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, reloadFromApi]);

  const jobs = ops?.jobs ?? [];
  const driversById = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s.empName || s.loginId])),
    [staff]
  );

  const addonNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of state.mobileAddons ?? []) {
      if (a.id) map.set(a.id, a.name?.trim() || a.id);
    }
    for (const block of state.vehicleCatalog ?? []) {
      for (const a of block.addons ?? []) {
        if (a.id && !map.has(a.id)) map.set(a.id, a.name?.trim() || a.id);
      }
    }
    return map;
  }, [state.mobileAddons, state.vehicleCatalog]);

  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const block of state.vehicleCatalog ?? []) {
      for (const svc of block.services ?? []) {
        if (svc.id) map.set(svc.id, svc.name?.trim() || svc.id);
      }
    }
    return map;
  }, [state.vehicleCatalog]);

  const filtered = useMemo(() => {
    const nameQ = filterName.trim().toLowerCase();
    const phoneQ = filterPhone.trim().toLowerCase();
    const serviceQ = filterService.trim().toLowerCase();
    const list = [...jobs].filter((j) => {
      if (j.slotDate < fromDate || j.slotDate > toDate) return false;
      if (nameQ && !j.customerName.toLowerCase().includes(nameQ)) return false;
      if (phoneQ && !(j.phone || '').toLowerCase().includes(phoneQ)) return false;
      const serviceText = formatJobServiceDisplay(j, serviceNameById, addonNameById).toLowerCase();
      if (serviceQ && !serviceText.includes(serviceQ)) return false;
      if (filterStatus !== 'all') {
        const normalized = normalizeMobileManagerJobStatus(j.status, j.assignedStaffId);
        const filterKey = normalized === 'checked_in' ? 'arrived' : normalized;
        if (filterKey !== filterStatus && normalized !== filterStatus) return false;
      }
      return true;
    });
    list.sort((a, b) => compareBookings(a, b, sortBy));
    return list;
  }, [jobs, fromDate, toDate, filterName, filterPhone, filterService, filterStatus, sortBy, serviceNameById, addonNameById]);

  const handleStatusChange = async (job: MobileManagerJob, newStatus: MobileManagerJobStatus) => {
    const currentStatus = normalizeMobileManagerJobStatus(job.status, job.assignedStaffId);
    if (toSelectStatus(currentStatus) === newStatus || statusSavingId === job.id) return;
    // Intercept: if moving to assigned without a driver, open manage dialog
    if (newStatus === 'assigned' && !job.assignedStaffId) {
      setEditJob(job);
      return;
    }
    setStatusError('');
    setStatusSavingId(job.id);
    try {
      await patchMobileManagerBooking(job.id, buildMobileBookingStatusPatch(job, newStatus));
      updateMobileOpsForPin(pin, (prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j)),
      }));
      await reloadFromApi();
    } catch (error) {
      setStatusError(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to persist booking status. Please try again.'
      );
    } finally {
      setStatusSavingId(null);
    }
  };

  if (!session || !isValidPinCode(pin) || !ops) return null;

  // Count per status for chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    for (const j of jobs) {
      const s = j.status === 'checked_in' ? 'arrived' : j.status;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  return (
    <div className="min-w-0 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">View bookings</h1>
      </header>

      <Card className={cn(cardSurface, 'overflow-hidden')}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-3">
            {/* Row 1: title/count | sort + refresh */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Bookings</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {filtered.length} job{filtered.length === 1 ? '' : 's'} shown.
                </CardDescription>
              </div>

              {/* Sort + Refresh */}
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="mobile-bookings-sort" className="sr-only">Sort by</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as BookingsSortBy)}>
                  <SelectTrigger
                    id="mobile-bookings-sort"
                    className="h-8 w-52 rounded-lg border-slate-200 bg-white text-xs shadow-sm"
                    aria-label="Sort bookings"
                  >
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[300] min-w-[13rem]">
                    <SelectItem value="created_new" className="text-xs">Booking Created (Newest first)</SelectItem>
                    <SelectItem value="created_old" className="text-xs">Booking Created (Oldest first)</SelectItem>
                    <SelectItem value="date_new" className="text-xs">Service Date (Newest first)</SelectItem>
                    <SelectItem value="date_old" className="text-xs">Service Date (Oldest first)</SelectItem>
                    <SelectItem value="name_asc" className="text-xs">Name (A–Z)</SelectItem>
                    <SelectItem value="name_desc" className="text-xs">Name (Z–A)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0"
                  disabled={isRefreshing}
                  onClick={handleRefresh}
                  title="Refresh bookings"
                >
                  <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                  {isRefreshing ? 'Refreshing…' : 'Refresh'}
                </Button>
              </div>
            </div>

            {/* Row 2: status chips — full width, no wrap */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {STATUS_FILTER_CHIPS.map(({ value, label }) => {
                const active = filterStatus === value;
                const colorMap: Record<string, string> = {
                  all:         active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600',
                  scheduled:   active ? 'bg-slate-700 text-white border-slate-700 shadow-sm'   : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                  assigned:    active ? 'bg-sky-600 text-white border-sky-600 shadow-sm'       : 'bg-white text-sky-700 border-sky-200 hover:border-sky-400',
                  arrived:     active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400',
                  in_progress: active ? 'bg-amber-500 text-white border-amber-500 shadow-sm'   : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400',
                  completed:   active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400',
                  cancelled:   active ? 'bg-rose-600 text-white border-rose-600 shadow-sm'     : 'bg-white text-rose-600 border-rose-200 hover:border-rose-400',
                };
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilterStatus(value)}
                    className={cn(
                      'shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-all duration-150',
                      colorMap[value] ?? colorMap['all'],
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Row 2: date range + search filters */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <DateFilterPopover value={fromDate} onChange={setFromDate} label="From date" />
                  <span className="shrink-0 text-muted-foreground" aria-hidden>–</span>
                  <DateFilterPopover value={toDate} onChange={setToDate} label="To date" />
                </div>
                <Input
                  type="search"
                  placeholder="Customer name"
                  className="h-9 min-w-[8rem] flex-1 rounded-lg border-slate-200 bg-white text-sm shadow-sm sm:max-w-[11rem] sm:flex-none"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  aria-label="Filter by customer name"
                />
                <Input
                  type="search"
                  placeholder="Phone"
                  className="h-9 min-w-[7rem] flex-1 rounded-lg border-slate-200 bg-white text-sm shadow-sm sm:max-w-[9rem] sm:flex-none"
                  value={filterPhone}
                  onChange={(e) => setFilterPhone(e.target.value)}
                  aria-label="Filter by phone"
                />
                <Input
                  type="search"
                  placeholder="Service"
                  className="h-9 min-w-[7rem] flex-1 rounded-lg border-slate-200 bg-white text-sm shadow-sm sm:max-w-[10rem] sm:flex-none"
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
                <colgroup>
                  <col className="w-[5.5rem]" />
                  <col className="w-[6.75rem]" />
                  <col className="w-[6.5rem]" />
                  <col className="w-[7rem]" />
                  <col className="w-[6.25rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[5.5rem]" />
                  <col className="w-[6.25rem]" />
                  <col className="w-[4.75rem]" />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/98 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-sm [&_tr]:border-b">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="h-11 whitespace-nowrap px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Booking ID</TableHead>
                    <TableHead className="h-11 px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</TableHead>
                    <TableHead className="h-11 whitespace-nowrap px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date &amp; Time</TableHead>
                    <TableHead className="h-11 px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Service</TableHead>
                    <TableHead className="h-11 whitespace-nowrap px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</TableHead>
                    <TableHead className="h-11 w-[95px] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Driver</TableHead>
                    <TableHead className="h-11 w-[90px] whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Booking date</TableHead>
                    <TableHead className="h-11 w-[6.25rem] whitespace-nowrap px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                    <TableHead className="h-11 w-[4.75rem] whitespace-nowrap pl-1 pr-2 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((j, i) => {
                    const rowStatus = normalizeMobileManagerJobStatus(j.status, j.assignedStaffId);
                    const meta = statusMeta(rowStatus);
                    const isSaving = statusSavingId === j.id;
                    const canEdit = canManagerPortalEditBookingJob(j, today);
                    const isTerminal = rowStatus === 'completed' || rowStatus === 'cancelled';
                    const allowedTransitions = getAllowedTransitions(rowStatus);
                    const createdDisplay = j.createdAt
                      ? new Date(j.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';
                    const serviceLine = formatJobServiceDisplay(j, serviceNameById, addonNameById);

                    return (
                      <TableRow
                        key={j.id}
                        className={cn(
                          'border-b border-slate-100 transition-colors hover:bg-slate-50/80',
                          i % 2 === 1 && 'bg-slate-50/30',
                        )}
                      >
                        {/* Booking ID */}
                        <TableCell className="whitespace-nowrap px-3 py-3 text-sm font-medium text-foreground">
                          {shortId(j.id, j.customerId, j.phone)}
                        </TableCell>

                        {/* Customer (name only) */}
                        <TableCell className="px-3 py-3">
                          <p className="max-w-[112px] truncate text-sm font-medium text-foreground leading-snug" title={j.customerName}>
                            {j.customerName}
                          </p>
                        </TableCell>

                        {/* Date & Time */}
                        <TableCell className="whitespace-nowrap px-3 py-3">
                          <p className="text-sm font-medium text-foreground tabular-nums">
                            {format(parse(j.slotDate, 'yyyy-MM-dd', new Date()), 'd MMM yy')}
                          </p>
                          <p className="text-xs text-foreground/60 tabular-nums mt-0.5">
                            {j.startTime}–{j.endTime}
                          </p>
                        </TableCell>

                        {/* Service — up to four lines */}
                        <TableCell className="px-2 py-3 align-top">
                          <p
                            className="line-clamp-4 text-sm font-medium leading-snug text-foreground break-words"
                            title={serviceLine === '—' ? undefined : serviceLine}
                          >
                            {serviceLine}
                          </p>
                        </TableCell>

                        {/* Phone */}
                        <TableCell className="whitespace-nowrap px-2 py-3 text-sm font-medium text-foreground">
                          {j.phone ? formatPhone(j.phone) : '—'}
                        </TableCell>

                        {/* Driver */}
                        <TableCell className="px-3 py-3 text-sm font-medium text-foreground">
                          <p className="max-w-[85px] truncate" title={j.assignedStaffId ? (driversById[j.assignedStaffId] ?? '—') : '—'}>
                            {j.assignedStaffId ? (driversById[j.assignedStaffId] ?? '—') : '—'}
                          </p>
                        </TableCell>

                        {/* Booking date */}
                        <TableCell className="whitespace-nowrap px-3 py-3 text-sm font-medium text-foreground">
                          {createdDisplay}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="px-2 py-3 pr-1">
                          {canEdit && !isTerminal ? (
                            <Select
                              value={toSelectStatus(rowStatus)}
                              onValueChange={(v) => handleStatusChange(j, v as MobileManagerJobStatus)}
                              disabled={isSaving}
                            >
                              <SelectTrigger
                                className={cn(
                                  'h-7 w-full max-w-[6.25rem] rounded-full border px-2 py-0 text-xs font-semibold shadow-none focus:ring-1 [&>span]:min-w-0 [&>span]:truncate',
                                  meta.className,
                                  isSaving && 'opacity-60',
                                )}
                              >
                                <SelectValue>
                                  <span className="truncate">{meta.label}</span>
                                </SelectValue>
                                {isSaving && <RefreshCw className="ml-1 size-3 animate-spin shrink-0" />}
                              </SelectTrigger>
                              <SelectContent className="z-[200]">
                                {allowedTransitions.map((o) => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold',
                                meta.className,
                              )}
                            >
                              {meta.label}
                            </span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pl-1 pr-2 py-3 text-right">
                          {(() => {
                            const isViewOnlyStatus = rowStatus === 'in_progress' || rowStatus === 'completed' || rowStatus === 'cancelled';
                            const isDisabled = !isViewOnlyStatus && !canEdit;
                            return (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={isDisabled}
                                title={
                                  isDisabled
                                    ? j.slotDate < today
                                      ? 'Past-dated bookings cannot be edited.'
                                      : 'Only active bookings can be edited.'
                                    : undefined
                                }
                                onClick={() => setEditJob(j)}
                              >
                                {isViewOnlyStatus ? 'View' : 'Manage'}
                              </Button>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditMobileBookingDialog
        open={!!editJob}
        onOpenChange={(o) => {
          if (!o) setEditJob(null);
        }}
        job={editJob}
        pin={pin}
        ops={ops}
        staff={staff}
        vehicleCatalog={state.vehicleCatalog}
        mobileAddons={state.mobileAddons}
      />
    </div>
  );
}
