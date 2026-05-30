import { useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { Trash2 } from 'lucide-react';
import type { Branch, BranchBookingJob, BranchData } from '../../lib/branchStore';
import { findBookingForBayWindow, listBookingsInWindowOnDate } from '../../lib/branchStore';
import type { GeneratedDaySlot, SlotDayOverride } from '../../lib/branchSlotSchedule';
import {
  dayWindowKey,
  getEffectiveSlotState,
  getRecurringSlotState,
  intervalsOverlapHHMM,
  slotWindowKey,
} from '../../lib/branchSlotSchedule';
import { eachIsoDateInInclusiveRange } from '../../lib/managerPortalUtils';
import { scheduleSliceFromBranchData } from '../../lib/configureSlotReschedule';
import { EditBranchBookingDialog } from './EditBranchBookingDialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { CalendarPopover } from './edit-branch-booking/CalendarPopover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type Pending = {
  label: string;
  applyData: (d: BranchData) => BranchData;
  /** Bookings that still block this change until moved or cancelled (recomputed from latest data). */
  getConflicts: (d: BranchData) => BranchBookingJob[];
  onApplied?: () => void;
};

type BayRangeClosure = {
  id: string;
  bayNumber: number;
  from: string;
  to: string;
};

type Props = {
  branchId: string;
  branch: Branch;
  data: BranchData;
  previewSlots: GeneratedDaySlot[];
  previewDate: string;
  onPreviewDateChange: (iso: string) => void;
  updateBranchData: (
    branchId: string,
    fn: (d: BranchData) => BranchData,
    options?: { syncBookings?: boolean }
  ) => Promise<void>;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatClosureDate(iso: string): string {
  try {
    return format(parse(iso, 'yyyy-MM-dd', new Date()), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

function collectJobsBlockedByDayTemplateOnDates(
  bookings: BranchBookingJob[],
  templateSlice: ReturnType<typeof scheduleSliceFromBranchData>,
  templateDate: string,
  rangeDates: string[],
  previewSlots: GeneratedDaySlot[],
  nBay: number
): BranchBookingJob[] {
  const seen = new Set<string>();
  const out: BranchBookingJob[] = [];
  for (const D of rangeDates) {
    for (const s of previewSlots) {
      const wk = slotWindowKey(s.startTime, s.endTime);
      const newEff = getEffectiveSlotState(templateSlice, templateDate, wk, nBay);
      for (const j of bookings) {
        if (['cancelled', 'completed', 'rejected', 'failed'].includes(j.status)) continue;
        if (j.slotDate !== D) continue;
        if (!intervalsOverlapHHMM(s.startTime, s.endTime, j.startTime, j.endTime)) continue;
        const bn = j.bayNumber ?? 1;
        if (bn < 1 || bn > nBay) continue;
        if (!newEff.slotActive || !newEff.baysOpen[bn - 1]) {
          if (!seen.has(j.id)) {
            seen.add(j.id);
            out.push(j);
          }
        }
      }
    }
  }
  return out;
}

export function ConfigureSlotsCalendar({
  branchId,
  branch,
  data,
  previewSlots,
  previewDate,
  onPreviewDateChange,
  updateBranchData,
}: Props) {
  const nBay = Math.max(1, branch.bayCount);
  const slice = useMemo(() => scheduleSliceFromBranchData(data), [data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [rescheduleJob, setRescheduleJob] = useState<BranchBookingJob | null>(null);
  const [rangeFrom, setRangeFrom] = useState(previewDate);
  const [rangeTo, setRangeTo] = useState(previewDate);
  const [selectedBayForRange, setSelectedBayForRange] = useState('1');
  const [rangeClosures, setRangeClosures] = useState<BayRangeClosure[]>([]);

  const rangeToMinDate = useMemo(() => {
    const today = todayIso();
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

  const blockingBookings = useMemo(() => {
    if (!dialogOpen || !pending) return [];
    return pending.getConflicts(data);
  }, [dialogOpen, pending, data]);

  const openReschedule = (next: Pending) => {
    const blocking = next.getConflicts(data);
    if (blocking.length === 0) {
      void updateBranchData(branchId, next.applyData, { syncBookings: false });
      next.onApplied?.();
      alert('Applied successfully!');
      return;
    }
    setPending(next);
    setDialogOpen(true);
  };

  const confirmApplyConfiguration = () => {
    if (!pending) return;
    const left = pending.getConflicts(data);
    if (left.length > 0) {
      window.alert(
        'There are still bookings in the slot(s) you are closing. Reschedule each booking using Reschedule, then try again.'
      );
      return;
    }
    void updateBranchData(branchId, pending.applyData, { syncBookings: false });
    pending.onApplied?.();
    setDialogOpen(false);
    setPending(null);
  };

  const cancelDialog = () => {
    setDialogOpen(false);
    setPending(null);
    setRescheduleJob(null);
  };

  const setDaySlotActive = (wk: string, active: boolean) => {
    const dk = dayWindowKey(previewDate, wk);
    const [st, et] = wk.split('|');
    if (!st || !et) return;
    if (!active) {
      openReschedule({
        label: `Turn off the whole time window on ${previewDate} (${st} – ${et})`,
        getConflicts: (d) => listBookingsInWindowOnDate(d.branchBookings, previewDate, st, et),
        applyData: (d) => {
          const eff = getEffectiveSlotState(scheduleSliceFromBranchData(d), previewDate, wk, nBay, dk);
          return {
            ...d,
            slotDayStates: {
              ...d.slotDayStates,
              [dk]: { slotActive: false, baysOpen: eff.baysOpen.map(() => false) },
            },
          };
        },
      });
      return;
    }
    void updateBranchData(
      branchId,
      (d) => {
        const rec = getRecurringSlotState(scheduleSliceFromBranchData(d), wk, nBay);
        return {
          ...d,
          slotDayStates: {
            ...d.slotDayStates,
            [dk]: { slotActive: true, baysOpen: rec.baysOpen },
          },
        };
      },
      { syncBookings: false }
    );
  };

  const setDayBayOpen = (wk: string, bayIndex0: number, open: boolean) => {
    const dk = dayWindowKey(previewDate, wk);
    const bayNum = bayIndex0 + 1;
    const [st, et] = wk.split('|');
    if (!st || !et) return;
    if (!open) {
      openReschedule({
        label: `Close bay ${bayNum} on ${previewDate} (${st} – ${et})`,
        getConflicts: (d) =>
          d.branchBookings.filter(
            (j) =>
              j.slotDate === previewDate &&
              !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status) &&
              intervalsOverlapHHMM(st, et, j.startTime, j.endTime) &&
              Number(j.bayNumber) === bayNum
          ),
        applyData: (d) => {
          const eff = getEffectiveSlotState(scheduleSliceFromBranchData(d), previewDate, wk, nBay);
          const bays = [...eff.baysOpen];
          bays[bayIndex0] = false;
          return {
            ...d,
            slotDayStates: {
              ...d.slotDayStates,
              [dk]: { slotActive: eff.slotActive, baysOpen: bays },
            },
          };
        },
      });
      return;
    }
    void updateBranchData(
      branchId,
      (d) => {
        const eff = getEffectiveSlotState(scheduleSliceFromBranchData(d), previewDate, wk, nBay);
        const bays = [...eff.baysOpen];
        bays[bayIndex0] = true;
        return {
          ...d,
          slotDayStates: {
            ...d.slotDayStates,
            [dk]: { slotActive: eff.slotActive, baysOpen: bays },
          },
        };
      },
      { syncBookings: false }
    );
  };

  const applySelectedDayPatternToRange = () => {
    const today = todayIso();
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
    openReschedule({
      label: `Copy ${previewDate} slot & bay pattern to ${range.length} day(s) (${range[0]} → ${range[range.length - 1]})`,
      getConflicts: (d) =>
        collectJobsBlockedByDayTemplateOnDates(
          d.branchBookings,
          scheduleSliceFromBranchData(d),
          previewDate,
          range,
          previewSlots,
          nBay
        ),
      applyData: (d) => {
        const sl = scheduleSliceFromBranchData(d);
        const nextDay: Record<string, SlotDayOverride> = {
          ...(d.slotDayStates ?? {}),
        };
        for (const D of range) {
          for (const s of previewSlots) {
            const wk = slotWindowKey(s.startTime, s.endTime);
            const eff = getEffectiveSlotState(sl, previewDate, wk, nBay);
            const dk = dayWindowKey(D, wk);
            nextDay[dk] = { slotActive: eff.slotActive, baysOpen: [...eff.baysOpen] };
          }
        }
        return { ...d, slotDayStates: nextDay };
      },
    });
  };

  const closeBayInDateRange = () => {
    const bayNumber = parseInt(selectedBayForRange, 10);
    if (!Number.isFinite(bayNumber) || bayNumber < 1 || bayNumber > nBay) {
      window.alert('Select a valid bay.');
      return;
    }
    const today = todayIso();
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
    openReschedule({
      label: `Close bay ${bayNumber} from ${range[0]} to ${range[range.length - 1]} (all time windows)`,
      getConflicts: (d) =>
        d.branchBookings.filter(
          (j) =>
            !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status) &&
            Number(j.bayNumber) === bayNumber &&
            range.includes(j.slotDate) &&
            previewSlots.some((s) => intervalsOverlapHHMM(s.startTime, s.endTime, j.startTime, j.endTime))
        ),
      applyData: (d) => {
        const sl = scheduleSliceFromBranchData(d);
        const nextDay: Record<string, SlotDayOverride> = {
          ...(d.slotDayStates ?? {}),
        };
        for (const D of range) {
          for (const s of previewSlots) {
            const wk = slotWindowKey(s.startTime, s.endTime);
            const dk = dayWindowKey(D, wk);
            const eff = getEffectiveSlotState(sl, D, wk, nBay);
            const bays = [...eff.baysOpen];
            bays[bayNumber - 1] = false;
            nextDay[dk] = { slotActive: eff.slotActive, baysOpen: bays };
          }
        }
        return { ...d, slotDayStates: nextDay };
      },
      onApplied: () => {
        setRangeClosures((cur) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            bayNumber,
            from: range[0]!,
            to: range[range.length - 1]!,
          },
          ...cur,
        ]);
      },
    });
  };

  const deleteRangeClosure = (item: BayRangeClosure) => {
    const range = eachIsoDateInInclusiveRange(item.from, item.to);
    void updateBranchData(
      branchId,
      (d) => {
        const sl = scheduleSliceFromBranchData(d);
        const nextDay: Record<string, SlotDayOverride> = {
          ...(d.slotDayStates ?? {}),
        };
        for (const D of range) {
          for (const s of previewSlots) {
            const wk = slotWindowKey(s.startTime, s.endTime);
            const dk = dayWindowKey(D, wk);
            const eff = getEffectiveSlotState(sl, D, wk, nBay);
            const bays = [...eff.baysOpen];
            bays[item.bayNumber - 1] = true;
            nextDay[dk] = { slotActive: eff.slotActive, baysOpen: bays };
          }
        }
        return { ...d, slotDayStates: Object.keys(nextDay).length ? nextDay : undefined };
      },
      { syncBookings: false }
    );
    setRangeClosures((cur) => cur.filter((x) => x.id !== item.id));
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
        <CalendarPopover
          slotDate={previewDate}
          resetKey={branchId}
          onDateChange={onPreviewDateChange}
        />
        <div className="max-h-[min(60vh,560px)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {previewSlots.map((s, idx) => {
              const wk = slotWindowKey(s.startTime, s.endTime);
              const eff = getEffectiveSlotState(slice, previewDate, wk, nBay);

              // Count how many open bays have an active booking.
              const bookedBayCount = eff.slotActive
                ? eff.baysOpen.reduce((acc, open, bi) => {
                    if (!open) return acc;
                    const job = findBookingForBayWindow(
                      data.branchBookings,
                      previewDate,
                      s.startTime,
                      s.endTime,
                      bi + 1
                    );
                    return acc + (job ? 1 : 0);
                  }, 0)
                : 0;
              const openBayCount = eff.baysOpen.filter(Boolean).length;
              const slotOccupancyLabel =
                !eff.slotActive
                  ? 'Off'
                  : bookedBayCount === openBayCount && openBayCount > 0
                    ? 'Full'
                    : bookedBayCount > 0
                      ? 'Partial'
                      : 'Open';
              const slotBadgeColor =
                !eff.slotActive
                  ? 'bg-slate-500 text-white'
                  : slotOccupancyLabel === 'Full'
                    ? 'bg-rose-600 text-white'
                    : slotOccupancyLabel === 'Partial'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white';

              return (
                <li key={wk} className="px-2 py-2 sm:px-3">
                  <button
                    type="button"
                    onClick={() => setDaySlotActive(wk, !eff.slotActive)}
                    className={cn(
                      'mb-2 flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors',
                      eff.slotActive
                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                        : 'border-slate-200 bg-slate-100/90 hover:bg-slate-100',
                    )}
                  >
                    <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted-foreground">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                        {s.startTime} – {s.endTime}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {eff.slotActive
                          ? `${openBayCount - bookedBayCount}/${openBayCount} bays available`
                          : 'window closed'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                        slotBadgeColor,
                      )}
                    >
                      {slotOccupancyLabel}
                    </span>
                  </button>

                  {!eff.slotActive ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-[11px] text-muted-foreground">
                      Slot inactive for this date
                    </div>
                  ) : (
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: 'repeat(auto-fit, minmax(4.75rem, 1fr))',
                      }}
                    >
                      {eff.baysOpen.map((open, bi) => {
                        const bayNum = bi + 1;
                        const bookedJob = open
                          ? findBookingForBayWindow(
                              data.branchBookings,
                              previewDate,
                              s.startTime,
                              s.endTime,
                              bayNum
                            )
                          : undefined;
                        const isBooked = !!bookedJob;
                        return (
                          <button
                            key={bi}
                            type="button"
                            onClick={() => setDayBayOpen(wk, bi, !open)}
                            className={cn(
                              'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1.5 py-1.5 text-[10px] font-semibold transition-all',
                              !open
                                ? 'border-slate-200 border-dashed bg-slate-50 text-slate-500 hover:bg-slate-100'
                                : isBooked
                                  ? 'border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-50'
                                  : 'border-blue-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50/50',
                            )}
                          >
                            <span>Bay {bayNum}</span>
                            <span className="font-normal text-[9px] opacity-80">
                              {!open ? 'Closed' : isBooked ? 'Booked' : 'Available'}
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

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold text-foreground">Custom date range</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Select date range and bay, then close that bay for the full range. Conflicting bookings must be moved first.
            </p>
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1 space-y-1 lg:max-w-[11rem]">
                <Label htmlFor="range-from">From</Label>
                <Input
                  id="range-from"
                  type="date"
                  min={todayIso()}
                  className="w-full min-w-0 bg-white"
                  value={rangeFrom}
                  onChange={(e) => handleRangeFromChange(e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1 lg:max-w-[11rem]">
                <Label htmlFor="range-to">To</Label>
                <Input
                  id="range-to"
                  type="date"
                  min={rangeToMinDate}
                  className="w-full min-w-0 bg-white"
                  value={rangeTo}
                  onChange={(e) => handleRangeToChange(e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1 lg:max-w-[11rem]">
                <Label>Select bay</Label>
                <Select value={selectedBayForRange} onValueChange={setSelectedBayForRange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Bay" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: nBay }, (_, i) => i + 1).map((b) => (
                      <SelectItem key={b} value={String(b)}>
                        Bay {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="destructive" className="w-full lg:w-auto" onClick={closeBayInDateRange}>
                Close bay
              </Button>
            </div>

            {rangeClosures.length > 0 ? (
              <div className="mt-4 w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs font-semibold text-foreground">
                  Closed bay ranges
                </p>
                <div
                  className="grid grid-cols-[1fr_1fr_5rem_6rem] items-center border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  role="row"
                >
                  <span role="columnheader">From</span>
                  <span role="columnheader">To</span>
                  <span role="columnheader" className="text-center">Bay</span>
                  <span role="columnheader" className="text-right">Action</span>
                </div>
                <ul className="divide-y divide-slate-100" role="rowgroup">
                  {rangeClosures.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[1fr_1fr_5rem_6rem] items-center px-4 py-3"
                      role="row"
                    >
                      <span className="text-sm tabular-nums text-foreground">
                        {formatClosureDate(item.from)}
                      </span>
                      <span className="text-sm tabular-nums text-foreground">
                        {formatClosureDate(item.to)}
                      </span>
                      <span className="text-center text-sm font-medium text-foreground">Bay {item.bayNumber}</span>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => deleteRangeClosure(item)}
                          aria-label={`Reopen bay ${item.bayNumber} from ${item.from} to ${item.to}`}
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

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && cancelDialog()}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Reschedule required</DialogTitle>
            <DialogDescription className="text-left">
              <span className="block font-medium text-foreground">{pending?.label}</span>
              <span className="mt-2 block">
                There is a booking in this slot. Reschedule each booking below (opens the full booking form with
                calendar and bay grid), then click <strong className="text-foreground">Apply configuration</strong> to
                finish closing the bay or slot.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {blockingBookings.length === 0 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950">
                No bookings are blocking this change anymore. You can apply the configuration.
              </p>
            ) : (
              blockingBookings.map((j) => (
                <div key={j.id} className="rounded-lg border border-indigo-100 bg-slate-50/50 p-3 text-sm">
                  <p className="font-medium text-foreground">{j.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Was: {j.slotDate} · {j.startTime} – {j.endTime} · Bay {j.bayNumber ?? '—'}
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
            <Button type="button" onClick={confirmApplyConfiguration} disabled={blockingBookings.length > 0}>
              Apply configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditBranchBookingDialog
        open={!!rescheduleJob}
        onOpenChange={(o) => {
          if (!o) setRescheduleJob(null);
        }}
        job={rescheduleJob}
        branchId={branchId}
        branch={branch}
        data={data}
        updateBranchData={updateBranchData}
      />
    </div>
  );
}
