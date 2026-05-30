import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';
import type { BookingJobStatus, Branch, BranchBookingJob, BranchData, Washer } from '../../lib/branchStore';
import { findBookingForBayWindow, washerIdsBusyInSlot } from '../../lib/branchStore';
import type { GeneratedDaySlot } from '../../lib/branchSlotSchedule';
import { getEffectiveSlotState, intervalsOverlapHHMM, slotWindowKey } from '../../lib/branchSlotSchedule';
import { scheduleSliceFromBranchData } from '../../lib/configureSlotReschedule';
import { currentHHMM, todayLocalISO } from '../../lib/managerPortalUtils';

export type BaySlotBoardMode = 'create' | 'assign';

type Props = {
  mode: BaySlotBoardMode;
  branch: Branch;
  data: BranchData;
  daySlots: GeneratedDaySlot[];
  slotDate?: string;
  selectedBaySlot?: { startTime: string; endTime: string; bayNumber: number } | null;
  onSelectBaySlot?: (p: { startTime: string; endTime: string; bayNumber: number }) => void;
  onPatchJob?: (jobId: string, patch: Partial<BranchBookingJob>) => void;
  washers?: Washer[];
  managerTerminalStatusOnly?: boolean;
  /** `compact` / `dense`: tighter cards for split panels; `dense` minimizes row height for less scrolling. */
  density?: 'default' | 'compact' | 'dense';
  /** When true, booked cells show read-only info only — no washer/status dropdowns. */
  hideBookedCellControls?: boolean;
};

const STATUS_OPTIONS: { value: BookingJobStatus; label: string }[] = [
  { value: 'scheduled', label: 'Booked' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function bookingStatusLabel(status: BookingJobStatus): string {
  const row = STATUS_OPTIONS.find((o) => o.value === status);
  return row?.label ?? status;
}

const TERMINAL_STATUSES: BookingJobStatus[] = ['completed', 'cancelled'];

export function BaySlotBoard({
  mode,
  branch,
  data,
  daySlots,
  slotDate,
  selectedBaySlot,
  onSelectBaySlot,
  onPatchJob,
  washers = [],
  managerTerminalStatusOnly = false,
  density = 'default',
  hideBookedCellControls = false,
}: Props) {
  const nBay = Math.max(1, branch.bayCount);
  const bookings = data.branchBookings;
  const slice = scheduleSliceFromBranchData(data);
  const date = slotDate ?? '';
  const compact = density === 'compact' || density === 'dense';
  const dense = density === 'dense';

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-full overflow-hidden border border-slate-200/80 bg-card shadow-sm',
        compact ? 'rounded-xl' : 'rounded-2xl',
      )}
    >
      <div className="divide-y divide-slate-100">
        {daySlots.map((s, rowIdx) => {
          const wk = slotWindowKey(s.startTime, s.endTime);
          const eff = date ? getEffectiveSlotState(slice, date, wk, nBay) : null;

          const openBayCount = eff ? eff.baysOpen.filter(Boolean).length : nBay;

          return (
            <div
              key={wk}
              className={cn(
                'transition-colors hover:bg-slate-50/50',
                dense ? 'px-1.5 py-1.5' : compact ? 'px-2 py-2 sm:px-3 sm:py-2.5' : 'px-3 py-4 sm:px-4 sm:py-5',
              )}
            >
              <div
                className={cn(
                  'flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5',
                  dense ? 'mb-1' : compact ? 'mb-2' : 'mb-3',
                )}
              >
                <span
                  className={cn(
                    'w-5 shrink-0 tabular-nums text-muted-foreground',
                    dense ? 'text-[9px]' : compact ? 'text-[10px]' : 'text-xs',
                  )}
                >
                  {rowIdx + 1}
                </span>
                <span
                  className={cn(
                    'font-semibold tabular-nums text-foreground',
                    dense ? 'text-[10px]' : compact ? 'text-xs' : 'text-sm sm:text-base',
                  )}
                >
                  {s.startTime} – {s.endTime}
                </span>
                {eff ? (
                  <span
                    className={cn(
                      'text-muted-foreground',
                      dense ? 'text-[9px]' : compact ? 'text-[10px]' : 'text-[11px] sm:text-xs',
                    )}
                  >
                    {!eff.slotActive ? '· window closed' : `· ${openBayCount}/${nBay} bays open`}
                  </span>
                ) : null}
              </div>

              {!eff || !eff.slotActive ? (
                <div
                  className={cn(
                    'rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-center text-muted-foreground',
                    dense ? 'py-2 text-[9px]' : compact ? 'py-3 text-[10px] sm:text-xs' : 'rounded-xl py-6 text-xs sm:text-sm',
                  )}
                >
                  Slot inactive for this date
                </div>
              ) : (
                <div
                  className={cn('grid', dense ? 'gap-1.5' : compact ? 'gap-2' : 'gap-3')}
                  style={{
                    gridTemplateColumns: dense
                      ? 'repeat(auto-fit, minmax(3.75rem, 1fr))'
                      : compact
                        ? 'repeat(auto-fit, minmax(4.75rem, 1fr))'
                        : 'repeat(auto-fit, minmax(5.5rem, 1fr))',
                  }}
                >
                  {Array.from({ length: nBay }, (_, bi) => {
                    const bayNum = bi + 1;
                    const open = eff.baysOpen[bi];
                    const job =
                      date && open
                        ? findBookingForBayWindow(bookings, date, s.startTime, s.endTime, bayNum)
                        : undefined;
                    const selected =
                      selectedBaySlot &&
                      selectedBaySlot.bayNumber === bayNum &&
                      intervalsOverlapHHMM(
                        s.startTime,
                        s.endTime,
                        selectedBaySlot.startTime,
                        selectedBaySlot.endTime
                      );

                    const isPast = date === todayLocalISO() && s.startTime < currentHHMM();
                    const slotSelectable = open && !isPast;

                    if (!open) {
                      return (
                        <div
                          key={bi}
                          className={cn(
                            'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/90 px-1.5 text-center text-muted-foreground',
                            dense
                              ? 'min-h-[2.5rem] py-1 text-[8px]'
                              : compact
                                ? 'min-h-[3.25rem] py-2 text-[9px] sm:text-[10px]'
                                : 'min-h-[6rem] gap-1 rounded-xl py-3 text-[10px] sm:text-xs',
                          )}
                        >
                          <span className="font-semibold">Bay {bayNum}</span>
                          <span className={dense ? 'text-[7px] opacity-80' : compact ? 'text-[8px] opacity-80' : 'text-[9px]'}>
                            Bay closed
                          </span>
                        </div>
                      );
                    }

                    if (job) {
                      const unavailableWasherIds = washerIdsBusyInSlot(
                        bookings,
                        date,
                        s.startTime,
                        s.endTime,
                        job.id
                      );
                      const washersForThisCell = washers.filter((w) => !unavailableWasherIds.has(w.id));
                      return (
                        <div
                          key={bi}
                          className={cn(
                            'space-y-2 rounded-xl border text-center shadow-sm',
                            dense
                              ? 'space-y-1 px-1.5 py-1.5'
                              : compact
                                ? 'space-y-1.5 px-2 py-2'
                                : 'min-h-[6rem] px-3 py-3 sm:min-h-0 sm:py-3.5',
                            mode === 'assign' ? 'border-slate-200 bg-white' : 'border-slate-200/80 bg-slate-50/60',
                          )}
                        >
                          <div className="flex flex-col items-center justify-center min-w-0">
                            <p
                              className={cn(
                                'font-semibold leading-tight text-foreground',
                                dense ? 'text-[9px]' : compact ? 'text-[10px]' : 'text-xs',
                              )}
                            >
                              Bay {bayNum}
                            </p>
                            <p className={cn('text-muted-foreground', dense ? 'text-[8px]' : compact ? 'text-[9px]' : 'text-[10px]')}>
                              {bookingStatusLabel(job.status)}
                            </p>
                          </div>
                          {mode === 'assign' && !hideBookedCellControls ? (
                            <>
                              <div className="space-y-1">
                                <Label className="sr-only" htmlFor={`ws-${job.id}`}>
                                  Washer
                                </Label>
                                <Select
                                  value={job.assignedWasherId ?? 'none'}
                                  onValueChange={(v) =>
                                    onPatchJob?.(job.id, { assignedWasherId: v === 'none' ? null : v })
                                  }
                                >
                                  <SelectTrigger
                                    id={`ws-${job.id}`}
                                    className={cn('min-w-0', dense ? 'h-6 text-[9px]' : compact ? 'h-7 text-[10px]' : 'h-8 text-xs')}
                                  >
                                    <SelectValue placeholder="Washer" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {washersForThisCell.map((w) => (
                                      <SelectItem key={w.id} value={w.id}>
                                        {w.name || w.loginId}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="sr-only" htmlFor={`st-${job.id}`}>
                                  Status
                                </Label>
                                <Select
                                  value={
                                    managerTerminalStatusOnly
                                      ? TERMINAL_STATUSES.includes(job.status)
                                        ? job.status
                                        : '__current__'
                                      : job.status
                                  }
                                  onValueChange={(v) => {
                                    if (v === '__current__') return;
                                    onPatchJob?.(job.id, { status: v as BookingJobStatus });
                                  }}
                                >
                                  <SelectTrigger
                                    id={`st-${job.id}`}
                                    className={cn('min-w-0', dense ? 'h-6 text-[9px]' : compact ? 'h-7 text-[10px]' : 'h-8 text-xs')}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {managerTerminalStatusOnly ? (
                                      <>
                                        {!TERMINAL_STATUSES.includes(job.status) ? (
                                          <SelectItem value="__current__">
                                            Current ({bookingStatusLabel(job.status)})
                                          </SelectItem>
                                        ) : null}
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </>
                                    ) : (
                                      STATUS_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                          {o.label}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          ) : hideBookedCellControls && job.assignedWasherId ? (
                            <p className={cn('truncate text-muted-foreground', dense ? 'text-[8px]' : compact ? 'text-[9px]' : 'text-[10px]')}>
                              {washers.find((w) => w.id === job.assignedWasherId)?.name
                                || washers.find((w) => w.id === job.assignedWasherId)?.loginId
                                || ''}
                            </p>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <Button
                        key={bi}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        disabled={!slotSelectable}
                        className={cn(
                          'flex h-auto w-full min-w-0 flex-col whitespace-normal border-2 shadow-sm transition-all',
                          dense
                            ? 'min-h-[2.5rem] gap-0 rounded-md px-1 py-1 text-[8px]'
                            : compact
                              ? 'min-h-[3.25rem] gap-0.5 rounded-lg px-1.5 py-2 text-[9px] sm:text-[10px]'
                              : 'min-h-[6rem] gap-1 rounded-xl px-2 py-3 text-[10px] sm:text-xs',
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-400/35 ring-offset-1 hover:bg-blue-600 hover:text-white'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50',
                          !slotSelectable && 'pointer-events-auto cursor-not-allowed opacity-60'
                        )}
                        onClick={() => {
                          if (!slotSelectable) return;
                          onSelectBaySlot?.({
                            startTime: s.startTime,
                            endTime: s.endTime,
                            bayNumber: bayNum,
                          });
                        }}
                      >
                        <span className="font-semibold">Bay {bayNum}</span>
                        <span className="font-normal opacity-90">
                          {isPast ? 'Past' : 'Available'}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
