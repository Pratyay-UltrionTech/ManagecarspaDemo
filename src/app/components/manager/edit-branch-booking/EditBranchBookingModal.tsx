import { useLayoutEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { AddonItem } from '../../../lib/catalogShapeTypes';
import type { Branch, BranchBookingJob, BranchData } from '../../../lib/branchStore';
import {
  findCatalogServiceById,
  listVehicleTypes,
  washerIdsBusyInSlot,
} from '../../../lib/branchStore';
import { branchBookingEndHHMM } from '../../../lib/branchSlotSchedule';
import {
  generateOperatingDaySlots,
  getEffectiveSlotState,
  normalizeSlotDurationMinutes,
  slotWindowKey,
} from '../../../lib/branchSlotSchedule';
import { scheduleSliceFromBranchData } from '../../../lib/configureSlotReschedule';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { cn } from '../../ui/utils';
import { BookingForm } from './BookingForm';
import { CalendarPopover } from './CalendarPopover';
import { SlotSelector } from './SlotSelector';
import { bookingConflict, normalizeEditableStatus } from './editBranchBookingUtils';
import {
  bookingScheduleOrStaffChanged,
  isBookingScheduleAndStaffLocked,
  todayLocalISO,
  currentHHMM,
} from '../../../lib/managerPortalUtils';
import { buildBookingPatchPayload, patchBranchManagerBooking } from '../../../lib/branchApi';
import { useBranchStore } from '../../../hooks/useBranchStore';
import { InProgressBookingDetailsPanel } from '../InProgressBookingDetailsPanel';

function branchAddonChoices(data: BranchData): AddonItem[] {
  if (data.branchAddons?.length) return data.branchAddons.filter((a) => a.active !== false);
  return Array.from(
    new Map(data.vehicleServices.flatMap((v) => v.addons ?? []).map((a) => [a.id, a])).values()
  ).filter((a) => a.active !== false);
}

function recomputeBookingEndTime(next: BranchBookingJob, data: BranchData): string {
  const svc = next.serviceId ? findCatalogServiceById(data, next.serviceId) : undefined;
  return branchBookingEndHHMM(
    next.startTime,
    svc?.durationMinutes ?? 60,
    next.selectedAddonIds?.length ?? 0
  );
}

export type EditBranchBookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: BranchBookingJob | null;
  branchId: string;
  branch: Branch;
  data: BranchData;
  updateBranchData: (
    branchId: string,
    fn: (d: BranchData) => BranchData,
    options?: { syncBookings?: boolean }
  ) => Promise<void>;
  /** When true, a washer must be selected before saving and status is forced to "assigned". */
  requireWasherAssign?: boolean;
};

export function EditBranchBookingModal({
  open,
  onOpenChange,
  job,
  branchId,
  branch,
  data,
  updateBranchData: _updateBranchData,
  requireWasherAssign = false,
}: EditBranchBookingModalProps) {
  const { refresh } = useBranchStore();
  const [draft, setDraft] = useState<BranchBookingJob | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (open && job) {
      const busy = washerIdsBusyInSlot(
        data.branchBookings,
        job.slotDate,
        job.startTime,
        job.endTime,
        job.id
      );
      const vt = listVehicleTypes(data);
      const locked = isBookingScheduleAndStaffLocked(job.status);
      const initialWasher = locked
        ? job.assignedWasherId
        : job.assignedWasherId && !busy.has(job.assignedWasherId)
          ? job.assignedWasherId
          : null;
      setDraft({
        ...job,
        status: normalizeEditableStatus(job.status),
        assignedWasherId: initialWasher,
        vehicleType: job.vehicleType.trim() || vt[0] || '—',
        selectedAddonIds: job.selectedAddonIds?.length ? [...job.selectedAddonIds] : [],
      });
      setFormError('');
    }
    if (!open) {
      setDraft(null);
    }
  }, [open, job?.id, data]);

  const pickerData: BranchData | null = useMemo(() => {
    if (!job) return null;
    return { ...data, branchBookings: data.branchBookings.filter((b) => b.id !== job.id) };
  }, [data, job]);

  const model = draft ?? job ?? null;

  const durationMins = normalizeSlotDurationMinutes(data.managerSlotDurationMinutes);
  const daySlots = useMemo(() => {
    return generateOperatingDaySlots(branch.openTime, branch.closeTime, branch.bayCount, durationMins);
  }, [branch, durationMins]);

  const washersForSelect = useMemo(() => {
    if (!model) return [];
    const busyWasherIds = washerIdsBusyInSlot(
      data.branchBookings,
      model.slotDate,
      model.startTime,
      model.endTime,
      model.id
    );
    const byId = new Map(data.washers.map((w) => [w.id, w]));
    const activeUnique = Array.from(byId.values()).filter((w) => w.active);
    // Only washers not assigned to another booking in this slot (current booking is excluded via model.id).
    const free = activeUnique.filter((w) => !busyWasherIds.has(w.id));
    if (isBookingScheduleAndStaffLocked(model.status) && model.assignedWasherId) {
      const current = byId.get(model.assignedWasherId);
      if (current && !free.some((w) => w.id === current.id)) return [...free, current];
    }
    return free;
  }, [data.washers, data.branchBookings, model]);

  // If slot/date changes and current washer is busy elsewhere in this window, clear to first free.
  useLayoutEffect(() => {
    if (!open || !draft) return;
    const busy = washerIdsBusyInSlot(
      data.branchBookings,
      draft.slotDate,
      draft.startTime,
      draft.endTime,
      draft.id
    );
    const wid = draft.assignedWasherId;
    if (wid && busy.has(wid)) {
      setDraft((cur) => (cur ? { ...cur, assignedWasherId: null } : cur));
    }
  }, [open, draft?.id, draft?.slotDate, draft?.startTime, draft?.endTime, data.branchBookings, data.washers]);

  const addonChoices = useMemo(() => branchAddonChoices(data), [data]);
  const selectedAddons = useMemo(
    () => addonChoices.filter((a) => (model?.selectedAddonIds ?? []).includes(a.id)),
    [addonChoices, model?.selectedAddonIds]
  );
  const assignedWasherLabel = useMemo(() => {
    if (!model?.assignedWasherId) return '—';
    const w = data.washers.find((x) => x.id === model.assignedWasherId);
    return w?.name || w?.loginId || '—';
  }, [data.washers, model?.assignedWasherId]);

  const patchModel = useCallback(
    (patch: Partial<BranchBookingJob>) => {
      setDraft((cur) => {
        if (!cur) return cur;
        let next = { ...cur, ...patch };
        if ('selectedAddonIds' in patch || 'serviceId' in patch || 'startTime' in patch) {
          next = { ...next, endTime: recomputeBookingEndTime(next, data) };
        }
        return next;
      });
    },
    [data]
  );

  const scheduleLocked = job ? isBookingScheduleAndStaffLocked(job.status) : false;
  // View-only mode: in_progress/checked_in (locked) OR already terminal (completed/cancelled)
  const isViewOnly = scheduleLocked || job?.status === 'completed' || job?.status === 'cancelled';

  const save = async () => {
    if (!job || !model || saving) return;
    setFormError('');
    if (scheduleLocked && bookingScheduleOrStaffChanged(job, model)) {
      setFormError('Cannot reschedule or change washer while work is in progress.');
      return;
    }
    const name = model.customerName.trim();
    if (!name) {
      setFormError('Enter customer name.');
      return;
    }
    if (model.bayNumber == null) {
      setFormError('Select a bay and time window on the left.');
      return;
    }
    const wk = slotWindowKey(model.startTime, model.endTime);
    const eff = getEffectiveSlotState(scheduleSliceFromBranchData(data), model.slotDate, wk, branch.bayCount);
    if (!eff.slotActive || !eff.baysOpen[model.bayNumber - 1]) {
      setFormError('That bay or window is closed for this date.');
      return;
    }
    const conflict = bookingConflict(
      data.branchBookings,
      job.id,
      model.slotDate,
      model.startTime,
      model.endTime,
      model.bayNumber
    );
    if (conflict) {
      setFormError('That slot is already taken. Pick another on the left.');
      return;
    }
    if (!model.assignedWasherId || !data.washers.some((w) => w.id === model.assignedWasherId)) {
      setFormError('Select a washer.');
      return;
    }
    const washerBusyInSlot = data.branchBookings.some(
      (b) =>
        b.id !== job.id &&
        b.slotDate === model.slotDate &&
        b.startTime === model.startTime &&
        b.endTime === model.endTime &&
        !['cancelled', 'completed', 'rejected', 'failed'].includes(b.status) &&
        b.assignedWasherId === model.assignedWasherId
    );
    if (washerBusyInSlot) {
      setFormError('Selected washer is already assigned in this slot.');
      return;
    }

    // --- Past Date/Time Validation ---
    const now = new Date();
    const today = todayLocalISO();
    if (model.slotDate < today) {
      setFormError('Cannot reschedule to a past date.');
      return;
    }
    if (model.slotDate === today && model.startTime < currentHHMM()) {
      setFormError('This time slot has already passed today.');
      return;
    }
    // ---------------------------------

    const wasUnassigned = !job.assignedWasherId;
    const nowAssigned = !!model.assignedWasherId;
    const autoStatus = requireWasherAssign && nowAssigned
      ? 'assigned'
      : wasUnassigned && nowAssigned && model.status === 'scheduled'
        ? 'assigned'
        : model.status;

    const serviceSummary = model.serviceSummary.trim() || '—';
    const nextJob: BranchBookingJob = {
      ...model,
      status: normalizeEditableStatus(autoStatus),
      serviceSummary,
      selectedAddonIds: model.selectedAddonIds ?? [],
    };
    setSaving(true);
    try {
      const patchPayload = buildBookingPatchPayload(job, nextJob);
      await patchBranchManagerBooking(job.id, patchPayload);
      await refresh();
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

  if (!job || !pickerData || !model) return null;

  const selectedBaySlot =
    model.bayNumber != null
      ? { startTime: model.startTime, endTime: model.endTime, bayNumber: model.bayNumber }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        className={cn(
          'z-[100] flex max-h-[min(92vh,880px)] flex-col gap-0 overflow-hidden rounded-xl border-slate-200/80 p-0 shadow-xl',
          isViewOnly
            ? 'w-[min(100vw-1.5rem,42rem)] sm:max-w-2xl'
            : 'w-[min(100vw-1.5rem,72rem)] sm:max-w-[min(100vw-2rem,72rem)]'
        )}
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader
          className={cn(
            'shrink-0 border-b border-slate-100 pr-14 text-left',
            isViewOnly ? 'px-4 py-3' : 'px-6 py-4'
          )}
        >
          <DialogTitle className="text-lg font-semibold tracking-tight">Manage Booking</DialogTitle>
          <DialogDescription className="sr-only">Update booking schedule and customer details.</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden',
            !isViewOnly && 'lg:flex-row'
          )}
        >
          {/* Left: calendar + slots (~38%) */}
          {!isViewOnly ? (
          <aside className="flex max-h-[min(56vh,520px)] min-h-0 w-full shrink-0 flex-col gap-2 overflow-y-auto border-b border-slate-200/80 bg-slate-50/60 p-3 sm:p-3 lg:max-h-full lg:w-[38%] lg:min-w-[260px] lg:border-b-0 lg:border-r">
            <CalendarPopover
              slotDate={model.slotDate}
              resetKey={job.id}
              dialogOpen={open}
              portalContainer={dialogContentRef.current}
              disabled={scheduleLocked}
              onDateChange={(nd) => {
                setDraft((cur) => {
                  if (!cur) return cur;
                  if (nd === cur.slotDate) return cur;
                  return { ...cur, slotDate: nd, bayNumber: null };
                });
                setFormError('');
              }}
            />
            <div className={cn(scheduleLocked && 'pointer-events-none opacity-60')}>
              <SlotSelector
                branch={branch}
                pickerData={pickerData}
                daySlots={daySlots}
                slotDate={model.slotDate}
                selectedBaySlot={selectedBaySlot}
                onSelectBaySlot={(p) => {
                  if (scheduleLocked) return;
                  setDraft((cur) => {
                    if (!cur) return cur;
                    const next = { ...cur, startTime: p.startTime, bayNumber: p.bayNumber };
                    return { ...next, endTime: recomputeBookingEndTime(next, data) };
                  });
                  setFormError('');
                }}
                className="min-h-[180px] flex-1 lg:min-h-0"
              />
            </div>
          </aside>
          ) : null}

          {/* Right: form (~62%) */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {requireWasherAssign && !isViewOnly && (
              <div className="shrink-0 flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-6 py-3">
                <span className="mt-px text-amber-500" aria-hidden>⚠</span>
                <p className="text-xs font-medium text-amber-800 leading-snug">
                  Please assign a washer before marking this booking as <strong>Assigned</strong>.
                </p>
              </div>
            )}
            <div className={cn('min-h-0 flex-1 overflow-y-auto', isViewOnly ? 'px-4 py-3' : 'px-6 py-5')}>
              {isViewOnly ? (
                <InProgressBookingDetailsPanel
                  customerName={model.customerName}
                  address={model.address}
                  phone={model.phone}
                  vehicleType={model.vehicleType}
                  vehicleName={model.vehicleName}
                  registrationNumber={model.registrationNumber}
                  service={model.serviceSummary?.split('+')[0]?.trim() ?? model.serviceSummary ?? '—'}
                  addonNames={selectedAddons.map((a) => a.name)}
                  slotDate={model.slotDate}
                  startTime={model.startTime}
                  endTime={model.endTime}
                  assigneeLabel="Washer name"
                  assigneeName={assignedWasherLabel}
                  bayNumber={model.bayNumber}
                />
              ) : (
                <BookingForm
                  model={model}
                  onPatch={patchModel}
                  washersForSelect={washersForSelect}
                  addonChoices={addonChoices}
                  highlightWasher={requireWasherAssign}
                  lockWasherAssign={false}
                />
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
              <Button
                type="button"
                variant="default"
                onClick={() => void save()}
                disabled={saving || (requireWasherAssign && !model.assignedWasherId)}
                title={requireWasherAssign && !model.assignedWasherId ? 'Select a washer to continue' : undefined}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
