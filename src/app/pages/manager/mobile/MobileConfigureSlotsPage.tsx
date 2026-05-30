import { useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { useMobileManagerSession } from '../../../hooks/useMobileManagerSession';
import { useMobileServicesStore } from '../../../hooks/useMobileServicesStore';
import {
  countActiveMobileDriversForPin,
  countMobileJobsInWindow,
  getEffectiveMobileSlotState,
  getEffectiveMobileSlotWindowActive,
  getMobileOpsForPin,
  isValidPinCode,
  normalizePinCode,
  type MobileManagerJob,
  type MobileOpsForPin,
} from '../../../lib/mobileServicesStore';
import { dayWindowKey, generateOperatingDaySlots, intervalsOverlapHHMM, slotWindowKey } from '../../../lib/branchSlotSchedule';
import { eachIsoDateInInclusiveRange, todayLocalISO } from '../../../lib/managerPortalUtils';
import {
  flushMobileSyncQueue,
  invalidatePendingMobileSync,
  patchMobileManagerSlotSettingsFromOps,
} from '../../../lib/mobileApi';
import { EditMobileBookingDialog } from '../../../components/manager/EditMobileBookingDialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { CalendarPopover } from '../../../components/manager/edit-branch-booking/CalendarPopover';
import { cn } from '../../../components/ui/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Trash2 } from 'lucide-react';

function mobileJobStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled': return 'Booked';
    case 'assigned': return 'Assigned';
    case 'arrived':
    case 'checked_in': return 'Arrived';
    case 'in_progress': return 'In Progress';
    default: return status;
  }
}

function getDriverJobInWindow(
  jobs: MobileManagerJob[],
  date: string,
  startTime: string,
  endTime: string,
  driverId: string
): MobileManagerJob | undefined {
  return jobs.find(
    (j) =>
      j.slotDate === date &&
      j.assignedStaffId === driverId &&
      !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status) &&
      intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)
  );
}

const SLOT_LEN = 60;

type DriverRangeClosure = {
  id: string;
  driverIdx: number;
  from: string;
  to: string;
};

function recurringDriverMaskForWindowFromOps(
  ops: MobileOpsForPin,
  wk: string,
  capacity: number
): boolean[] {
  const raw = ops.slotDriverOpenByWindow?.[wk];
  return Array.from({ length: capacity }, (_, i) =>
    i < (raw?.length ?? 0) ? raw![i] !== false : true
  );
}

function applyDeleteRangeClosureToOps(
  prev: MobileOpsForPin,
  item: DriverRangeClosure,
  capacity: number
): MobileOpsForPin {
  const range = eachIsoDateInInclusiveRange(item.from, item.to);
  const rangeSet = new Set(range);
  const nextDay = { ...(prev.slotDayStates ?? {}) };
  for (const dk of Object.keys(nextDay)) {
    const pipe = dk.indexOf('|');
    if (pipe < 0) continue;
    const date = dk.slice(0, pipe);
    if (!rangeSet.has(date)) continue;
    const wk = dk.slice(pipe + 1);
    const [st, et] = wk.split('|');
    if (!st || !et) continue;
    const eff = getEffectiveMobileSlotState(prev, date, st, et, capacity);
    const driversOpen = [...eff.driversOpen];
    driversOpen[item.driverIdx] = true;
    const allOpen = driversOpen.every(Boolean);
    const recurringOpen = prev.slotWindowActiveByKey?.[wk] !== false;
    if (allOpen && recurringOpen) {
      const recurringMask = recurringDriverMaskForWindowFromOps(prev, wk, capacity);
      const matchesDefault =
        driversOpen.length === recurringMask.length &&
        driversOpen.every((open, i) => open === recurringMask[i]);
      if (matchesDefault) delete nextDay[dk];
      else nextDay[dk] = { slotActive: true, driversOpen };
    } else {
      nextDay[dk] = { slotActive: driversOpen.some(Boolean), driversOpen };
    }
  }
  return {
    ...prev,
    slotDayStates: Object.keys(nextDay).length ? nextDay : undefined,
  };
}

function formatClosureDate(iso: string): string {
  try {
    return format(parse(iso, 'yyyy-MM-dd', new Date()), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

type Pending = {
  label: string;
  applyData: (d: MobileOpsForPin) => MobileOpsForPin;
  getConflicts: (d: MobileOpsForPin) => MobileManagerJob[];
  onApplied?: () => void;
};

export default function MobileConfigureSlotsPage() {
  const { session } = useMobileManagerSession();
  const { state, staff, updateMobileOpsForPin, updateMobileOpsForPinAsync, reloadFromApi } =
    useMobileServicesStore();
  const pin = session?.cityPinCode ? normalizePinCode(session.cityPinCode) : '';
  const ops = useMemo(() => (pin ? getMobileOpsForPin(state, pin) : null), [state, pin]);
  const driverCount = useMemo(() => (pin ? countActiveMobileDriversForPin(staff, pin) : 0), [staff, pin]);

  const [previewDate, setPreviewDate] = useState(todayLocalISO());
  const [rangeFrom, setRangeFrom] = useState(previewDate);
  const [rangeTo, setRangeTo] = useState(previewDate);
  const [selectedDriverForRange, setSelectedDriverForRange] = useState('0');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [rescheduleJob, setRescheduleJob] = useState<MobileManagerJob | null>(null);

  const activeDrivers = useMemo(
    () => staff.filter((s) => normalizePinCode(s.cityPinCode) === pin && s.active),
    [staff, pin]
  );
  const capacity = Math.max(1, driverCount);
  const daySlots = useMemo(() => {
    if (!ops) return [];
    return generateOperatingDaySlots(ops.openTime, ops.closeTime, capacity, SLOT_LEN);
  }, [ops, capacity]);

  // Derive driver range closures from persisted slotDayStates so the table
  // survives page refreshes and navigation (pure local state was lost on remount).
  const derivedDriverClosures = useMemo((): DriverRangeClosure[] => {
    if (!ops?.slotDayStates) return [];
    // Group day-window entries by date
    const dateWindowMap = new Map<string, Map<string, { driversOpen: boolean[] }>>();
    for (const [dk, dayState] of Object.entries(ops.slotDayStates)) {
      // dk = "yyyy-MM-dd|HH:mm|HH:mm"
      const date = dk.slice(0, 10);
      if (!dateWindowMap.has(date)) dateWindowMap.set(date, new Map());
      dateWindowMap.get(date)!.set(dk.slice(11), dayState as { driversOpen: boolean[] });
    }
    // For each date, find drivers that are closed in every window stored for that date
    const driverClosedDates = new Map<number, Set<string>>();
    for (const [date, windows] of dateWindowMap) {
      const windowStates = [...windows.values()];
      for (let di = 0; di < capacity; di++) {
        const allClosed = windowStates.length > 0 && windowStates.every((s) => !s.driversOpen[di]);
        if (allClosed) {
          if (!driverClosedDates.has(di)) driverClosedDates.set(di, new Set());
          driverClosedDates.get(di)!.add(date);
        }
      }
    }
    // Collapse consecutive dates per driver into ranges
    const result: DriverRangeClosure[] = [];
    for (const [di, dates] of driverClosedDates) {
      const sorted = [...dates].sort();
      let from = sorted[0]!;
      let prev = from;
      for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i]!;
        const gap = (new Date(cur + 'T00:00:00').getTime() - new Date(prev + 'T00:00:00').getTime()) / 86_400_000;
        if (gap === 1) { prev = cur; }
        else { result.push({ id: `${di}-${from}`, driverIdx: di, from, to: prev }); from = cur; prev = cur; }
      }
      result.push({ id: `${di}-${from}`, driverIdx: di, from, to: prev });
    }
    return result.sort((a, b) => a.from.localeCompare(b.from) || a.driverIdx - b.driverIdx);
  }, [ops?.slotDayStates, capacity]);

  if (!session || !isValidPinCode(pin) || !ops) return null;

  const blockingJobs = pending ? pending.getConflicts(ops) : [];

  const openReschedule = (next: Pending) => {
    const blocking = next.getConflicts(ops);
    if (blocking.length === 0) {
      updateMobileOpsForPin(pin, next.applyData);
      next.onApplied?.();
      return;
    }
    setPending(next);
    setDialogOpen(true);
  };

  const confirmApplyConfiguration = () => {
    if (!pending) return;
    const left = pending.getConflicts(ops);
    if (left.length > 0) {
      window.alert(
        'There are still bookings in the slot(s) you are closing. Reschedule each booking, then apply again.'
      );
      return;
    }
    updateMobileOpsForPin(pin, pending.applyData);
    pending.onApplied?.();
    setDialogOpen(false);
    setPending(null);
  };

  const cancelDialog = () => {
    setDialogOpen(false);
    setPending(null);
    setRescheduleJob(null);
  };

  const recurringDriverMaskForWindow = (wk: string): boolean[] => {
    const raw = ops.slotDriverOpenByWindow?.[wk];
    const out = Array.from({ length: capacity }, (_, i) => (i < (raw?.length ?? 0) ? raw![i] !== false : true));
    return out;
  };

  const setDayWindowActive = (wk: string, active: boolean) => {
    const dk = dayWindowKey(previewDate, wk);
    const [st, et] = wk.split('|');
    if (!st || !et) return;
    if (!active) {
      openReschedule({
        label: `Turn off the whole time window on ${previewDate} (${st} – ${et})`,
        getConflicts: (d) =>
          d.jobs.filter(
            (j) =>
              j.slotDate === previewDate &&
              j.startTime === st &&
              j.endTime === et &&
              !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status)
          ),
        applyData: (prev) => {
          const nextDay = { ...(prev.slotDayStates ?? {}) };
          const recurringOpen = prev.slotWindowActiveByKey?.[wk] !== false;
          if (recurringOpen && !prev.slotDriverOpenByWindow?.[wk]) {
            nextDay[dk] = { slotActive: false, driversOpen: Array.from({ length: capacity }, () => false) };
          } else {
            nextDay[dk] = { slotActive: false, driversOpen: Array.from({ length: capacity }, () => false) };
          }
          return {
            ...prev,
            slotDayStates: Object.keys(nextDay).length ? nextDay : undefined,
          };
        },
      });
      return;
    }
    updateMobileOpsForPin(pin, (prev) => {
      const nextDay = { ...(prev.slotDayStates ?? {}) };
      const recurringOpen = prev.slotWindowActiveByKey?.[wk] !== false;
      if (active) {
        if (recurringOpen && !prev.slotDriverOpenByWindow?.[wk]) delete nextDay[dk];
        else nextDay[dk] = { slotActive: true, driversOpen: recurringDriverMaskForWindow(wk) };
      } else {
        nextDay[dk] = { slotActive: false, driversOpen: Array.from({ length: capacity }, () => false) };
      }
      return {
        ...prev,
        slotDayStates: Object.keys(nextDay).length ? nextDay : undefined,
      };
    });
  };

  const setDayDriverOpen = (wk: string, driverIdx: number, open: boolean) => {
    const dk = dayWindowKey(previewDate, wk);
    const [st, et] = wk.split('|');
    if (!st || !et) return;
    if (!open) {
      openReschedule({
        label: `Close ${activeDrivers[driverIdx]?.empName ?? `Driver ${driverIdx + 1}`} on ${previewDate} (${st} – ${et})`,
        getConflicts: (d) =>
          d.jobs.filter(
            (j) =>
              j.slotDate === previewDate &&
              j.startTime === st &&
              j.endTime === et &&
              !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status)
          ),
        applyData: (prev) => {
          const nextDay = { ...(prev.slotDayStates ?? {}) };
          const eff = getEffectiveMobileSlotState(prev, previewDate, st, et, capacity);
          const driversOpen = [...eff.driversOpen];
          driversOpen[driverIdx] = false;
          nextDay[dk] = { slotActive: driversOpen.some(Boolean), driversOpen };
          return {
            ...prev,
            slotDayStates: Object.keys(nextDay).length ? nextDay : undefined,
          };
        },
      });
      return;
    }
    updateMobileOpsForPin(pin, (prev) => {
      const nextDay = { ...(prev.slotDayStates ?? {}) };
      const eff = getEffectiveMobileSlotState(prev, previewDate, st, et, capacity);
      const driversOpen = [...eff.driversOpen];
      driversOpen[driverIdx] = open;
      nextDay[dk] = { slotActive: driversOpen.some(Boolean), driversOpen };
      return {
        ...prev,
        slotDayStates: Object.keys(nextDay).length ? nextDay : undefined,
      };
    });
  };

  const rangeToMinDate = useMemo(() => {
    const today = todayLocalISO();
    if (!rangeFrom) return today;
    return rangeFrom > today ? rangeFrom : today;
  }, [rangeFrom]);

  const handleRangeFromChange = (value: string) => {
    setRangeFrom(value);
    if (value && rangeTo && rangeTo < value) setRangeTo(value);
  };

  const handleRangeToChange = (value: string) => {
    if (value && rangeFrom && value < rangeFrom) {
      setRangeTo(rangeFrom);
      return;
    }
    setRangeTo(value);
  };

  const closeDriverInDateRange = (driverIdx: number) => {
    const today = todayLocalISO();
    if (rangeFrom < today || rangeTo < today) {
      window.alert('From and To must be today or future dates.');
      return;
    }
    if (rangeTo < rangeFrom) {
      window.alert('To date cannot be before From date.');
      return;
    }
    const range = eachIsoDateInInclusiveRange(rangeFrom.trim(), rangeTo.trim());
    if (range.length === 0) {
      window.alert('Choose a valid from and to date.');
      return;
    }
    const driverId = staff.filter(s => s.cityPinCode === pin && s.active)[driverIdx]?.id;
    
    openReschedule({
      label: `Close ${activeDrivers[driverIdx]?.empName ?? `Driver ${driverIdx + 1}`} from ${range[0]} to ${range[range.length - 1]} (all time windows)`,
      getConflicts: (d) =>
        d.jobs.filter(
          (j) =>
            !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status) &&
            j.assignedStaffId === driverId &&
            range.includes(j.slotDate)
        ),
      applyData: (prev) => {
        const nextDay = { ...(prev.slotDayStates ?? {}) };
        for (const D of range) {
          for (const s of daySlots) {
            const wk = slotWindowKey(s.startTime, s.endTime);
            const dk = dayWindowKey(D, wk);
            const eff = getEffectiveMobileSlotState(prev, D, s.startTime, s.endTime, capacity);
            const driversOpen = [...eff.driversOpen];
            driversOpen[driverIdx] = false;
            nextDay[dk] = { slotActive: driversOpen.some(Boolean), driversOpen };
          }
        }
        return { ...prev, slotDayStates: nextDay };
      },
    });
  };

  const deleteRangeClosure = async (item: DriverRangeClosure) => {
    if (!ops) return;
    try {
      // Cancel queued background syncs that can re-push deleted closures after save.
      invalidatePendingMobileSync();
      await flushMobileSyncQueue();
      const nextOps = applyDeleteRangeClosureToOps(ops, item, capacity);
      await patchMobileManagerSlotSettingsFromOps(nextOps);
      invalidatePendingMobileSync();
      await flushMobileSyncQueue();
      await reloadFromApi();
    } catch {
      window.alert('Could not remove closed range. Please try again.');
    }
  };

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Configure slot</h1>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 pb-4 pt-5">
          <CardTitle className="text-base font-semibold">Schedule summary</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Working hours and capacity come from your saved mobile schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200/80 bg-gradient-to-br from-white to-indigo-50/50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{ops.openTime}</p>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-gradient-to-br from-white to-indigo-50/50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Close</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{ops.closeTime}</p>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-gradient-to-br from-white to-indigo-50/50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active drivers</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{driverCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-6 pb-5 pt-6">
          <CardTitle className="text-base font-semibold">Calendar & availability</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 overflow-x-hidden px-6 py-6">
          <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
            <CalendarPopover slotDate={previewDate} resetKey={pin} onDateChange={setPreviewDate} />
            <div className="max-h-[min(60vh,560px)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {daySlots.map((s, idx) => {
                  const wk = slotWindowKey(s.startTime, s.endTime);
                  const stateForDay = getEffectiveMobileSlotState(ops, previewDate, s.startTime, s.endTime, capacity);
                  const booked = countMobileJobsInWindow(ops.jobs, previewDate, s.startTime, s.endTime);
                  return (
                    <li key={wk} className="px-2 py-2 sm:px-3">
                      <button
                        type="button"
                        onClick={() => setDayWindowActive(wk, !stateForDay.slotActive)}
                        className={cn(
                          'mb-2 flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors',
                          stateForDay.slotActive
                            ? 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                            : 'border-slate-200 bg-slate-100/90 hover:bg-slate-100'
                        )}
                      >
                        <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted-foreground">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                            {s.startTime} – {s.endTime}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {stateForDay.slotActive
                              ? `${stateForDay.driversOpen.filter(Boolean).length}/${capacity} drivers open · ${booked}/${capacity} booked`
                              : 'window closed'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                            stateForDay.slotActive ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'
                          )}
                        >
                          {stateForDay.slotActive ? 'Open' : 'Off'}
                        </span>
                      </button>

                      {!stateForDay.slotActive ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-[11px] text-muted-foreground">
                          Slot inactive for this date
                        </div>
                      ) : (
                        <div
                          className="grid gap-2"
                          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(5rem, 1fr))' }}
                        >
                          {stateForDay.driversOpen.map((open, di) => {
                            const driver = activeDrivers[di];
                            const driverName = driver?.empName ?? `Driver ${di + 1}`;
                            const bookedJob = open && driver
                              ? getDriverJobInWindow(ops.jobs, previewDate, s.startTime, s.endTime, driver.id)
                              : undefined;

                            if (bookedJob) {
                              return (
                                <div
                                  key={`${wk}-d${di}`}
                                  className="space-y-0.5 rounded-lg border border-slate-200/80 bg-slate-50/60 px-2 py-2 text-left text-[10px] shadow-sm"
                                >
                                  <p className="line-clamp-1 font-medium leading-tight text-foreground">
                                    {bookedJob.customerName || 'Customer'}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground">
                                    {mobileJobStatusLabel(bookedJob.status)}
                                  </p>
                                  <p className="text-[9px] font-semibold text-blue-600">{driverName}</p>
                                </div>
                              );
                            }

                            return (
                              <button
                                key={`${wk}-d${di}`}
                                type="button"
                                onClick={() => setDayDriverOpen(wk, di, !open)}
                                className={cn(
                                  'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1.5 py-1.5 text-[10px] font-semibold transition-all',
                                  open
                                    ? 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50/50'
                                    : 'cursor-pointer border-dashed border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                )}
                              >
                                <span>{driverName}</span>
                                <span className="font-normal text-[9px] opacity-80">
                                  {open ? 'Available' : 'Closed'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold text-foreground">Custom date range</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Select date range and driver, then close that driver for the full range. Conflicting bookings must be
              moved first.
            </p>
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1 space-y-1 lg:max-w-[11rem]">
                <Label htmlFor="m-rf">From</Label>
                <Input
                  id="m-rf"
                  type="date"
                  min={todayLocalISO()}
                  className="w-full min-w-0 bg-white"
                  value={rangeFrom}
                  onChange={(e) => handleRangeFromChange(e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1 lg:max-w-[11rem]">
                <Label htmlFor="m-rt">To</Label>
                <Input
                  id="m-rt"
                  type="date"
                  min={rangeToMinDate}
                  className="w-full min-w-0 bg-white"
                  value={rangeTo}
                  onChange={(e) => handleRangeToChange(e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1 lg:max-w-[11rem]">
                <Label>Select driver</Label>
                <Select value={selectedDriverForRange} onValueChange={setSelectedDriverForRange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: capacity }, (_, i) => i).map((i) => (
                      <SelectItem key={i} value={String(i)}>
                        {activeDrivers[i]?.empName ?? `Driver ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full lg:w-auto"
                onClick={() => closeDriverInDateRange(parseInt(selectedDriverForRange, 10))}
              >
                Close driver
              </Button>
            </div>

            {derivedDriverClosures.length > 0 ? (
              <div className="mt-4 w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs font-semibold text-foreground">
                  Closed driver ranges
                </p>
                <div
                  className="grid grid-cols-[1fr_1fr_minmax(0,1fr)_6rem] items-center border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  role="row"
                >
                  <span role="columnheader">From</span>
                  <span role="columnheader">To</span>
                  <span role="columnheader">Driver</span>
                  <span role="columnheader" className="text-right">
                    Action
                  </span>
                </div>
                <ul className="divide-y divide-slate-100" role="rowgroup">
                  {derivedDriverClosures.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[1fr_1fr_minmax(0,1fr)_6rem] items-center px-4 py-3"
                      role="row"
                    >
                      <span className="text-sm tabular-nums text-foreground">{formatClosureDate(item.from)}</span>
                      <span className="text-sm tabular-nums text-foreground">{formatClosureDate(item.to)}</span>
                      <span className="truncate text-sm font-medium text-foreground">
                        {activeDrivers[item.driverIdx]?.empName ?? `Driver ${item.driverIdx + 1}`}
                      </span>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => deleteRangeClosure(item)}
                          aria-label={`Reopen ${activeDrivers[item.driverIdx]?.empName ?? `Driver ${item.driverIdx + 1}`} from ${item.from} to ${item.to}`}
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>



        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && cancelDialog()}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Reschedule required</DialogTitle>
            <DialogDescription className="text-left">
              <span className="block font-medium text-foreground">{pending?.label}</span>
              <span className="mt-2 block">
                There are bookings in this slot. Reschedule each booking below, then click{' '}
                <strong className="text-foreground">Apply configuration</strong>.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {blockingJobs.length === 0 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950">
                No bookings are blocking this change anymore. You can apply the configuration.
              </p>
            ) : (
              blockingJobs.map((j) => (
                <div key={j.id} className="rounded-lg border border-indigo-100 bg-slate-50/50 p-3 text-sm">
                  <p className="font-medium text-foreground">{j.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Was: {j.slotDate} · {j.startTime} – {j.endTime}
                  </p>
                  <Button type="button" className="mt-3" size="sm" onClick={() => setRescheduleJob(j)}>
                    Reschedule
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={cancelDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmApplyConfiguration} disabled={blockingJobs.length > 0}>
              Apply configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditMobileBookingDialog
        open={!!rescheduleJob}
        onOpenChange={(o) => {
          if (!o) setRescheduleJob(null);
        }}
        job={rescheduleJob}
        pin={pin}
        ops={ops}
        staff={staff}
        vehicleCatalog={state.vehicleCatalog}
        mobileAddons={state.mobileAddons}
      />
    </div>
  );
}
