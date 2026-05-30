import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AddonItem, VehicleServiceBlock } from '../../lib/catalogShapeTypes';
import {
  countActiveMobileDriversForPin,
  getEffectiveMobileSlotWindowActive,
  listMobileServiceOptions,
  normalizePinCode,
  type MobileManagerJob,
  type MobileOpsForPin,
  type MobileServiceStaff,
} from '../../lib/mobileServicesStore';
import {
  generateOperatingDaySlots,
  intervalsOverlapHHMM,
  normalizeSlotDurationMinutes,
  slotWindowKey,
} from '../../lib/branchSlotSchedule';
import {
  countOverlappingMobileJobs,
  inferMobileDriverLaneForJob,
  isMobileDriverLaneOpen,
  isMobileDriverLaneOpenForBookingSpan,
} from '../../lib/mobileDriverLanes';
import {
  extractZipFromAddress,
  isDriverBusyForWindow,
  isDriverServiceableForZip,
  listMobileDriversForBookingZip,
  resolveBookingZipCode,
} from '../../lib/mobileDriverEligibility';
import {
  bookingScheduleOrStaffChanged,
  isBookingScheduleAndStaffLocked,
  todayLocalISO,
  currentHHMM,
} from '../../lib/managerPortalUtils';
import { buildMobileBookingPatchPayload, patchMobileManagerBooking } from '../../lib/mobileApi';
import { useMobileServicesStore } from '../../hooks/useMobileServicesStore';
import { Button } from '../ui/button';
import { CalendarPopover } from './edit-branch-booking/CalendarPopover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { InProgressBookingDetailsPanel } from './InProgressBookingDetailsPanel';

function serviceLabel(options: { id: string; label: string }[], id: string | null): string {
  if (!id) return '—';
  return options.find((o) => o.id === id)?.label ?? id;
}

function parseHHMM(t: string): number {
  const [h, m] = String(t ?? '').split(':').map(Number);
  return ((h ?? 0) * 60 + (m ?? 0));
}

function addMinutesToHHMM(t: string, delta: number): string {
  const total = (parseHHMM(t) + delta) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function driversFreeInWindow(
  jobs: MobileManagerJob[],
  date: string,
  startTime: string,
  endTime: string,
  activeDrivers: MobileServiceStaff[],
  excludeJobId: string
): MobileServiceStaff[] {
  return activeDrivers.filter(
    (d) => !isDriverBusyForWindow(jobs, date, startTime, endTime, d.id, excludeJobId)
  );
}

/** Build addon id → label from mobile-wide + vehicle-block addons. */
function buildMobileAddonLookup(vehicleCatalog: VehicleServiceBlock[], mobileAddons: AddonItem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of mobileAddons ?? []) {
    if (a.id && (a.active === undefined || a.active)) m.set(a.id, (a.name || '').trim());
  }
  for (const block of vehicleCatalog ?? []) {
    for (const a of block.addons ?? []) {
      if (a.id && (a.active === undefined || a.active)) m.set(a.id, (a.name || '').trim());
    }
  }
  return m;
}

function resolveSelectedAddonTitles(ids: string[] | undefined, lookup: Map<string, string>): string[] {
  if (!ids?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const name = (lookup.get(id) || '').trim();
    const label = name || id;
    const k = label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(label);
  }
  return out;
}

/** A single labelled detail row matching branch manager BookingForm style. */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 leading-snug break-words">
        {value?.trim() || <span className="text-slate-400 font-normal">—</span>}
      </p>
    </div>
  );
}

function formatPhoneDisplay(phone?: string | null): string | null {
  const raw = phone;
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('+')) return s.replace(/^\+61(\d)/, '+61-$1');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+61-${digits.slice(1)}`;
  if (digits.length === 9) return `+61-${digits}`;
  return s;
}

function assignedDriverLabel(
  drivers: MobileServiceStaff[],
  assignedStaffId: string | null | undefined
): string {
  if (!assignedStaffId) return '—';
  const d = drivers.find((x) => x.id === assignedStaffId);
  return d?.empName || d?.loginId || 'Assigned';
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: MobileManagerJob | null;
  pin: string;
  ops: MobileOpsForPin;
  staff: MobileServiceStaff[];
  vehicleCatalog: VehicleServiceBlock[];
  mobileAddons: AddonItem[];
};

export function EditMobileBookingDialog({
  open,
  onOpenChange,
  job,
  pin,
  ops,
  staff,
  vehicleCatalog,
  mobileAddons,
}: Props) {
  const { reloadFromApi } = useMobileServicesStore();
  const [draft, setDraft] = useState<MobileManagerJob | null>(null);
  const [pickerDate, setPickerDate] = useState('');
  const [pickerSlotKey, setPickerSlotKey] = useState('');
  const [pickerDriverId, setPickerDriverId] = useState<string>('none');
  /** Capacity lane 1..N (not a named driver). */
  const [pickerDriverLane, setPickerDriverLane] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);

  const activeDrivers = useMemo(
    () => staff.filter((s) => normalizePinCode(s.cityPinCode) === pin && s.active),
    [staff, pin]
  );
  const driverCount = useMemo(() => countActiveMobileDriversForPin(staff, pin), [staff, pin]);
  const capacity = Math.max(1, driverCount);
  const durationMins = normalizeSlotDurationMinutes(ops.slotDurationMinutes ?? 60);
  const daySlots = useMemo(
    () => generateOperatingDaySlots(ops.openTime, ops.closeTime, capacity, durationMins),
    [ops.openTime, ops.closeTime, capacity, durationMins]
  );

  const addonLookup = useMemo(
    () => buildMobileAddonLookup(vehicleCatalog, mobileAddons ?? []),
    [vehicleCatalog, mobileAddons]
  );

  useLayoutEffect(() => {
    if (open && job) {
      setDraft({ ...job });
      setFormError('');
      setPickerDate(job.slotDate);
      const gridSlot =
        daySlots.find((s) => s.startTime === job.startTime) ??
        daySlots.find((s) => s.startTime <= job.startTime && s.endTime > job.startTime);
      setPickerSlotKey(
        gridSlot
          ? slotWindowKey(gridSlot.startTime, gridSlot.endTime)
          : slotWindowKey(job.startTime, job.endTime)
      );
      setPickerDriverId(job.assignedStaffId ?? 'none');
      setPickerDriverLane(null);
    }
    if (!open) {
      setDraft(null);
      setPickerDriverLane(null);
    }
    // Only re-init when the dialog opens or a different booking is loaded — not when daySlots refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.id]);

  const model = draft ?? job ?? null;
  const scheduleLocked = job ? isBookingScheduleAndStaffLocked(job.status) : false;
  // View-only mode: in_progress/checked_in (locked) OR already terminal (completed/cancelled)
  const isViewOnly = scheduleLocked || job?.status === 'completed' || job?.status === 'cancelled';

  const addonTitlesForJob = useMemo(() => resolveSelectedAddonTitles(model?.selectedAddonIds, addonLookup), [addonLookup, model?.selectedAddonIds]);

  const openSlotsOnPickerDate = useMemo(() => {
    return daySlots.filter((s) =>
      getEffectiveMobileSlotWindowActive(ops, pickerDate, s.startTime, s.endTime)
    );
  }, [daySlots, ops, pickerDate]);

  const serviceOptions = useMemo(() => listMobileServiceOptions(vehicleCatalog), [vehicleCatalog]);

  const bookingDurationMins = useMemo(() => {
    if (!model) return durationMins;
    const d = parseHHMM(model.endTime) - parseHHMM(model.startTime);
    return d > 0 ? d : durationMins;
  }, [model, durationMins]);

  const bookingZip = useMemo(
    () => (job ? resolveBookingZipCode(job, draft?.address) : ''),
    [job, draft?.address]
  );

  /** Drivers for this manager pin who are explicitly serviceable for the booking postcode. */
  const serviceableDrivers = useMemo(
    () => listMobileDriversForBookingZip(staff, pin, bookingZip),
    [staff, pin, bookingZip]
  );

  const driverLaneCount = serviceableDrivers.length;

  useEffect(() => {
    if (!open || !job || driverLaneCount < 1) return;
    setPickerDriverLane((cur) => {
      if (cur != null && cur >= 1 && cur <= driverLaneCount) return cur;
      return inferMobileDriverLaneForJob(ops.jobs, job, driverLaneCount);
    });
  }, [open, job?.id, driverLaneCount, ops.jobs]);

  const freeDriversForPicker = useMemo(() => {
    if (!job || !model?.startTime || !model?.endTime || pickerDate !== model.slotDate) {
      return serviceableDrivers;
    }
    return driversFreeInWindow(
      ops.jobs,
      model.slotDate,
      model.startTime,
      model.endTime,
      serviceableDrivers,
      job.id
    );
  }, [job, model, pickerDate, ops.jobs, serviceableDrivers]);

  const selectDriverLaneAndTime = (laneNum: number, slotKey: string, dateIso: string) => {
    const [st, gridEt] = slotKey.split('|');
    if (!st || !job) return;
    const endTime = addMinutesToHHMM(st, bookingDurationMins);
    if (
      !isMobileDriverLaneOpenForBookingSpan(
        ops.jobs,
        dateIso,
        st,
        endTime,
        laneNum,
        driverLaneCount,
        daySlots,
        job.id
      )
    ) {
      setFormError('That driver slot is booked for part of this time range.');
      return;
    }
    setPickerDriverLane(laneNum);
    setPickerSlotKey(slotWindowKey(st, gridEt || endTime));
    setPickerDate(dateIso);
    setPickerDriverId('none');
    setFormError('');
    setDraft((cur) =>
      cur
        ? {
            ...cur,
            slotDate: dateIso,
            startTime: st,
            endTime: endTime,
            assignedStaffId: null,
          }
        : cur
    );
  };

  const handleDateChange = (nextDate: string) => {
    if (scheduleLocked || !job) return;
    setPickerDate(nextDate);
    setFormError('');
    const openOnDay = daySlots.filter((s) =>
      getEffectiveMobileSlotWindowActive(ops, nextDate, s.startTime, s.endTime)
    );
    const keepStart = model?.startTime;
    const sameStart =
      keepStart &&
      openOnDay.find(
        (s) =>
          s.startTime === keepStart &&
          !(nextDate === todayLocalISO() && s.startTime < currentHHMM())
      );
    const lane = pickerDriverLane ?? 1;
    if (sameStart) {
      selectDriverLaneAndTime(lane, slotWindowKey(sameStart.startTime, sameStart.endTime), nextDate);
      return;
    }
    const first = openOnDay.find(
      (s) => !(nextDate === todayLocalISO() && s.startTime < currentHHMM())
    );
    if (first) {
      selectDriverLaneAndTime(lane, slotWindowKey(first.startTime, first.endTime), nextDate);
    } else {
      setDraft((cur) => (cur ? { ...cur, slotDate: nextDate } : cur));
    }
  };

  const handleDriverPickerChange = (driverId: string) => {
    setPickerDriverId(driverId);
    setDraft((cur) => {
      if (!cur) return cur;
      if (driverId === 'none') {
        return {
          ...cur,
          assignedStaffId: null,
          ...(cur.status === 'assigned' ? { status: 'scheduled' as const } : {}),
        };
      }
      return {
        ...cur,
        assignedStaffId: driverId,
        ...(cur.status === 'scheduled' ? { status: 'assigned' as const } : {}),
      };
    });
  };

  useEffect(() => {
    if (!open) return;
    if (pickerDriverId !== 'none' && !serviceableDrivers.some((d) => d.id === pickerDriverId)) {
      handleDriverPickerChange('none');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pickerDriverId, serviceableDrivers]);

  const hasSelectedWindow =
    !!model?.startTime &&
    !!model?.endTime &&
    pickerDate === model.slotDate &&
    pickerDriverLane != null;

  const save = async () => {
    if (!job || !model || saving) return;
    setFormError('');

    if (scheduleLocked && bookingScheduleOrStaffChanged(job, model)) {
      setFormError('Cannot reschedule or change driver while work is in progress.');
      return;
    }

    if (!scheduleLocked && !model.assignedStaffId) {
      setFormError('Assign first, then save.');
      return;
    }

    const today = todayLocalISO();
    if (model.slotDate < today) {
      setFormError('Cannot reschedule to a past date.');
      return;
    }
    if (model.slotDate === today && model.startTime < currentHHMM()) {
      setFormError('This time slot has already passed today.');
      return;
    }

    if (!model.address.trim()) {
      setFormError('Address is missing for this booking.');
      return;
    }
    if (!getEffectiveMobileSlotWindowActive(ops, model.slotDate, model.startTime, model.endTime)) {
      setFormError('That time window is closed for this date.');
      return;
    }
    const lane = pickerDriverLane ?? 1;
    if (driverLaneCount < 1) {
      setFormError('No drivers serviceable for this postcode.');
      return;
    }
    if (
      !isMobileDriverLaneOpenForBookingSpan(
        ops.jobs,
        model.slotDate,
        model.startTime,
        model.endTime,
        lane,
        driverLaneCount,
        daySlots,
        job.id
      )
    ) {
      setFormError('That driver slot is not available for the full booking window.');
      return;
    }
    if (model.assignedStaffId) {
      const assigned = serviceableDrivers.find((d) => d.id === model.assignedStaffId);
      const bookingZip = resolveBookingZipCode(job, model.address);
      if (!assigned || !isDriverServiceableForZip(assigned, bookingZip, { strict: true })) {
        setFormError('Assigned driver is not serviceable for booking zip.');
        return;
      }
      if (isDriverBusyForWindow(ops.jobs, model.slotDate, model.startTime, model.endTime, model.assignedStaffId, job.id)) {
        setFormError('That driver is already assigned in this window.');
        return;
      }
    }

    const summary = serviceLabel(serviceOptions, model.serviceId);
    const wasUnassigned = !job.assignedStaffId;
    const nowAssigned = !!model.assignedStaffId;
    const autoAssignStatus =
      wasUnassigned && nowAssigned && model.status === 'scheduled' ? 'assigned' : model.status;
    const next: MobileManagerJob = {
      ...model,
      status: autoAssignStatus,
      vehicleSummary: model.serviceId ? summary : model.vehicleSummary || model.vehicleType || '—',
      notes: job.notes,
      selectedAddonIds: [...(model.selectedAddonIds ?? [])],
    };

    setSaving(true);
    try {
      const patchPayload = buildMobileBookingPatchPayload(job, next);
      await patchMobileManagerBooking(job.id, patchPayload);
      await reloadFromApi();
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save booking. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!job || !model) return null;

  const field = 'h-10 rounded-lg border-slate-200 bg-white shadow-sm';
  const serviceDisplay =
    serviceOptions.length > 0 && model.serviceId ? serviceLabel(serviceOptions, model.serviceId) : (model.vehicleSummary || '').trim() || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        className={cn(
          'flex max-h-[min(92vh,880px)] flex-col gap-0 overflow-hidden rounded-xl border-slate-200/80 p-0 shadow-xl',
          isViewOnly
            ? 'w-[min(100vw-1.5rem,42rem)] sm:max-w-2xl'
            : 'w-[min(100vw-1.5rem,72rem)] sm:max-w-[min(100vw-2rem,72rem)]'
        )}
      >
        <DialogHeader
          className={cn(
            'shrink-0 border-b border-slate-100 pr-14 text-left',
            isViewOnly ? 'px-4 py-3' : 'px-6 py-4'
          )}
        >
          <DialogTitle className="text-lg font-semibold tracking-tight">Manage booking</DialogTitle>
          <DialogDescription className="sr-only">
            Reschedule the booking, assign a driver, and view customer details.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden',
            !isViewOnly && 'lg:flex-row'
          )}
        >
          {/* Left: calendar + slot+driver board (branch-manager style) */}
          {!isViewOnly ? (
          <aside className="flex max-h-[min(56vh,520px)] min-h-0 w-full shrink-0 flex-col gap-2 overflow-y-auto border-b border-slate-200/80 bg-slate-50/60 p-3 lg:max-h-full lg:w-[38%] lg:min-w-[280px] lg:border-b-0 lg:border-r">
            <CalendarPopover
              slotDate={pickerDate}
              resetKey={job.id}
              dialogOpen={open}
              portalContainer={dialogContentRef.current}
              disabled={scheduleLocked}
              onDateChange={handleDateChange}
            />

            {/* Slot + driver board */}
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-card shadow-sm',
                scheduleLocked && 'pointer-events-none opacity-60'
              )}
            >
              {openSlotsOnPickerDate.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">All windows closed this day.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {openSlotsOnPickerDate.map((s, idx) => {
                    const k = slotWindowKey(s.startTime, s.endTime);
                    const isPast = pickerDate === todayLocalISO() && s.startTime < currentHHMM();
                    const bookedInRow = countOverlappingMobileJobs(
                      ops.jobs,
                      pickerDate,
                      s.startTime,
                      s.endTime,
                      job.id
                    );
                    const openLanes = Math.max(0, driverLaneCount - bookedInRow);

                    return (
                      <div
                        key={k}
                        className="px-2 py-2 transition-colors hover:bg-slate-50/50 sm:px-3 sm:py-2.5"
                      >
                        <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="w-5 shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {s.startTime} – {s.endTime}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {isPast
                              ? '· slot time passed'
                              : driverLaneCount === 0
                                ? '· no drivers for postcode'
                                : `· ${openLanes}/${driverLaneCount} driver slot${driverLaneCount !== 1 ? 's' : ''} open`}
                          </span>
                        </div>

                        {driverLaneCount === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 py-3 text-center text-[10px] text-muted-foreground">
                            No drivers serviceable for this postcode
                          </div>
                        ) : (
                          <div
                            className="grid gap-2"
                            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(4.75rem, 1fr))' }}
                          >
                            {Array.from({ length: driverLaneCount }, (_, bi) => {
                              const laneNum = bi + 1;
                              const laneOpen = isMobileDriverLaneOpen(
                                ops.jobs,
                                pickerDate,
                                s.startTime,
                                s.endTime,
                                laneNum,
                                driverLaneCount,
                                job.id
                              );
                              const laneSelected =
                                hasSelectedWindow &&
                                pickerDriverLane === laneNum &&
                                model.startTime &&
                                model.endTime &&
                                intervalsOverlapHHMM(
                                  model.startTime,
                                  model.endTime,
                                  s.startTime,
                                  s.endTime
                                );
                              const laneSelectable = !isPast && laneOpen && !scheduleLocked;

                              if (!laneOpen) {
                                return (
                                  <div
                                    key={laneNum}
                                    className="flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/90 px-1.5 py-2 text-center text-[10px] font-semibold text-muted-foreground"
                                  >
                                    <span>Driver {laneNum}</span>
                                    <span className="text-[9px] font-normal opacity-80">Booked</span>
                                  </div>
                                );
                              }

                              return (
                                <Button
                                  key={laneNum}
                                  type="button"
                                  variant={laneSelected ? 'default' : 'outline'}
                                  size="sm"
                                  disabled={!laneSelectable}
                                  className={cn(
                                    'flex h-auto min-h-[3.25rem] w-full min-w-0 flex-col whitespace-normal border-2 px-1.5 py-2 text-[10px] font-semibold shadow-sm',
                                    laneSelected
                                      ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-400/35 ring-offset-1 hover:bg-blue-600 hover:text-white'
                                      : 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50/50',
                                    !laneSelectable && 'pointer-events-auto cursor-not-allowed opacity-60'
                                  )}
                                  onClick={() =>
                                    laneSelectable && selectDriverLaneAndTime(laneNum, k, pickerDate)
                                  }
                                >
                                  <span>Driver {laneNum}</span>
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
              )}
            </div>

            {/* Selected summary — matches branch manager blue style */}
            <div
              className={cn(
                'shrink-0 rounded-lg border px-3 py-2 text-center text-xs tabular-nums',
                hasSelectedWindow
                  ? 'border-blue-200 bg-blue-50/90 font-medium text-blue-950'
                  : 'border-slate-200 bg-slate-50 text-muted-foreground'
              )}
            >
              {hasSelectedWindow ? (
                <>
                  <span className="text-blue-700/80">Selected: </span>
                  {model.startTime} – {model.endTime}
                  <span className="text-blue-600/60"> · </span>
                  Driver {pickerDriverLane} slot
                  {pickerDriverId !== 'none' ? (
                    <>
                      <span className="text-blue-600/60"> · </span>
                      {serviceableDrivers.find((d) => d.id === pickerDriverId)?.empName ||
                        serviceableDrivers.find((d) => d.id === pickerDriverId)?.loginId ||
                        'Assigned'}
                    </>
                  ) : (
                    <span className="font-normal text-blue-800/70"> · assign named driver on the right</span>
                  )}
                </>
              ) : (
                'Select a driver slot and time, then assign a driver on the right'
              )}
            </div>
          </aside>
          ) : null}

          {/* Right: sectioned form matching branch manager style */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={cn('min-h-0 flex-1 overflow-y-auto', isViewOnly ? 'px-4 py-3' : 'px-6 py-5')}>
              {isViewOnly ? (
                <InProgressBookingDetailsPanel
                  customerName={model.customerName}
                  address={model.address}
                  phone={model.phone}
                  vehicleType={model.vehicleType}
                  vehicleName={model.vehicleName}
                  registrationNumber={model.registrationNumber}
                  service={serviceDisplay}
                  addonNames={addonTitlesForJob}
                  slotDate={model.slotDate}
                  startTime={model.startTime}
                  endTime={model.endTime}
                  assigneeLabel="Driver name"
                  assigneeName={assignedDriverLabel(serviceableDrivers, model.assignedStaffId)}
                />
              ) : (
              <div className="grid gap-6">

                {/* Customer section */}
                <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Name" value={model.customerName} />
                    <DetailRow label="Phone" value={formatPhoneDisplay(model.phone)} />
                  </div>
                  {model.address ? <DetailRow label="Address" value={model.address} /> : null}
                </section>

                {/* Vehicle section */}
                <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Vehicle</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Vehicle type" value={model.vehicleType} />
                    <DetailRow label="Vehicle name" value={model.vehicleName} />
                    <DetailRow label="Registration number" value={model.registrationNumber?.trim().toUpperCase()} />
                  </div>
                </section>

                {/* Service section */}
                <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Service</p>
                  <DetailRow label="Service" value={serviceDisplay} />
                  {addonTitlesForJob.length > 0 && (
                    <div className="grid gap-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Add-ons</p>
                      <div className="grid gap-0.5">
                        {addonTitlesForJob.map((title, idx) => (
                          <p key={`${job.id}-addon-${idx}`} className="text-sm font-medium text-slate-800 leading-snug">
                            {title}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* Driver assignment section (editable) */}
                <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Assign driver</p>
                  <div className="grid gap-2">
                    {freeDriversForPicker.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No drivers available for this window.</p>
                    ) : (
                      <Select value={pickerDriverId} onValueChange={handleDriverPickerChange}>
                        <SelectTrigger className={cn(field, 'w-full')}>
                          <SelectValue placeholder="Select a driver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select a driver</SelectItem>
                          {freeDriversForPicker.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.empName || d.loginId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </section>

              </div>
              )}

              {formError ? <p className="mt-4 text-sm text-destructive">{formError}</p> : null}
            </div>
          </div>
        </div>

        <DialogFooter
          className={cn(
            'shrink-0 gap-2 border-t border-slate-100 bg-slate-50/80 sm:justify-end',
            isViewOnly ? 'px-4 py-3' : 'px-6 py-4'
          )}
        >
          {isViewOnly ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
