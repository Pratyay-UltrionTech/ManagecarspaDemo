import type { Branch, BranchBookingJob, BranchData } from './branchStore';
import { findBookingForBayWindow } from './branchStore';
import {
  generateOperatingDaySlots,
  getEffectiveSlotState,
  normalizeSlotDurationMinutes,
  slotWindowKey,
  type SlotScheduleSlice,
} from './branchSlotSchedule';

export function scheduleSliceFromBranchData(data: BranchData): SlotScheduleSlice {
  return {
    slotWindowActiveByKey: data.slotWindowActiveByKey,
    slotBayOpenByWindow: data.slotBayOpenByWindow,
    slotDayStates: data.slotDayStates,
  };
}

export type ReschedulePick = {
  slotDate: string;
  startTime: string;
  endTime: string;
  bayNumber: number;
  label: string;
  value: string;
};

/** Open bay cells for a date (for moving bookings). Optionally ignore one booking id when checking occupancy. */
export function listOpenBaySlotPicks(
  branch: Branch,
  data: BranchData,
  targetDate: string,
  excludeBookingId?: string
): ReschedulePick[] {
  const duration = normalizeSlotDurationMinutes(data.managerSlotDurationMinutes);
  const slots = generateOperatingDaySlots(branch.openTime, branch.closeTime, branch.bayCount, duration);
  const slice = scheduleSliceFromBranchData(data);
  const bookings = excludeBookingId
    ? data.branchBookings.filter((j) => j.id !== excludeBookingId)
    : data.branchBookings;
  const out: ReschedulePick[] = [];
  for (const s of slots) {
    const wk = slotWindowKey(s.startTime, s.endTime);
    const eff = getEffectiveSlotState(slice, targetDate, wk, branch.bayCount);
    if (!eff.slotActive) continue;
    for (let b = 1; b <= branch.bayCount; b++) {
      if (!eff.baysOpen[b - 1]) continue;
      if (findBookingForBayWindow(bookings, targetDate, s.startTime, s.endTime, b)) continue;
      out.push({
        slotDate: targetDate,
        startTime: s.startTime,
        endTime: s.endTime,
        bayNumber: b,
        label: `${s.startTime} – ${s.endTime} · Bay ${b}`,
        value: `${s.startTime}\t${s.endTime}\t${b}`,
      });
    }
  }
  return out;
}

export function parseReschedulePickValue(value: string): { startTime: string; endTime: string; bayNumber: number } | null {
  const parts = value.split('\t');
  if (parts.length !== 3) return null;
  const [st, et, bn] = parts;
  const bay = parseInt(String(bn), 10);
  if (!st || !et || !Number.isFinite(bay)) return null;
  return { startTime: st, endTime: et, bayNumber: bay };
}

export function patchBookingsReschedule(
  bookings: BranchBookingJob[],
  moves: { jobId: string; slotDate: string; startTime: string; endTime: string; bayNumber: number }[]
): BranchBookingJob[] {
  const map = new Map(moves.map((m) => [m.jobId, m]));
  return bookings.map((j) => {
    const m = map.get(j.id);
    if (!m) return j;
    return {
      ...j,
      slotDate: m.slotDate,
      startTime: m.startTime,
      endTime: m.endTime,
      bayNumber: m.bayNumber,
    };
  });
}
