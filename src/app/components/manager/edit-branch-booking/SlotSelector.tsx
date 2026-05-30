import type { Branch, BranchBookingJob, BranchData, Washer } from '../../../lib/branchStore';
import type { GeneratedDaySlot } from '../../../lib/branchSlotSchedule';
import type { BaySlotBoardMode } from '../BaySlotBoard';
import { BaySlotBoard } from '../BaySlotBoard';
import { cn } from '../../ui/utils';

type BaySlot = { startTime: string; endTime: string; bayNumber: number };

type Props = {
  branch: Branch;
  pickerData: BranchData;
  daySlots: GeneratedDaySlot[];
  slotDate: string;
  selectedBaySlot: BaySlot | null;
  onSelectBaySlot: (slot: BaySlot) => void;
  className?: string;
  mode?: BaySlotBoardMode;
  washers?: Washer[];
  onPatchJob?: (jobId: string, patch: Partial<BranchBookingJob>) => void;
  managerTerminalStatusOnly?: boolean;
  density?: 'default' | 'compact' | 'dense';
  /** When true, booked cells show read-only info only — no washer/status dropdowns. */
  hideBookedCellControls?: boolean;
};

export function SlotSelector({
  branch,
  pickerData,
  daySlots,
  slotDate,
  selectedBaySlot,
  onSelectBaySlot,
  className,
  mode = 'create',
  washers = [],
  onPatchJob,
  managerTerminalStatusOnly = false,
  density = 'compact',
  hideBookedCellControls = false,
}: Props) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-2', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <BaySlotBoard
          mode={mode}
          branch={branch}
          data={pickerData}
          daySlots={daySlots}
          slotDate={slotDate}
          selectedBaySlot={selectedBaySlot}
          onSelectBaySlot={onSelectBaySlot}
          washers={washers}
          onPatchJob={onPatchJob}
          managerTerminalStatusOnly={managerTerminalStatusOnly}
          density={density}
          hideBookedCellControls={hideBookedCellControls}
        />
      </div>
      <div
        className={cn(
          'shrink-0 rounded-lg border px-3 py-2 text-center text-xs tabular-nums sm:text-sm',
          selectedBaySlot
            ? 'border-blue-200 bg-blue-50/90 font-medium text-blue-950'
            : 'border-slate-200 bg-slate-50 text-muted-foreground'
        )}
      >
        {selectedBaySlot ? (
          <>
            <span className="text-muted-foreground">Selected: </span>
            {selectedBaySlot.startTime} – {selectedBaySlot.endTime}{' '}
            <span className="text-blue-600/60">•</span> Bay {selectedBaySlot.bayNumber}
          </>
        ) : (
          'Select a time window and bay'
        )}
      </div>
    </div>
  );
}
