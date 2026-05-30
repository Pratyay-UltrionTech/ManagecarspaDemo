import type { MobileManagerJob } from './mobileServicesStore';
import { intervalsOverlapHHMM, parseTimeToMinutes } from './branchSlotSchedule';

const TERMINAL = new Set(['cancelled', 'completed', 'rejected', 'failed']);

export function countOverlappingMobileJobs(
  jobs: MobileManagerJob[],
  slotDate: string,
  windowStart: string,
  windowEnd: string,
  exceptJobId?: string
): number {
  return jobs.filter(
    (j) =>
      j.id !== exceptJobId &&
      j.slotDate === slotDate &&
      !TERMINAL.has(j.status) &&
      intervalsOverlapHHMM(j.startTime, j.endTime, windowStart, windowEnd)
  ).length;
}

/** Capacity lane N (1-based) is free for this 30-min grid row. */
export function isMobileDriverLaneOpen(
  jobs: MobileManagerJob[],
  slotDate: string,
  rowStart: string,
  rowEnd: string,
  laneNum: number,
  laneCount: number,
  exceptJobId?: string
): boolean {
  if (laneNum < 1 || laneNum > laneCount) return false;
  const booked = countOverlappingMobileJobs(jobs, slotDate, rowStart, rowEnd, exceptJobId);
  return booked < laneNum;
}

/** Lane stays free for every 30-min row touched by [bookingStart, bookingEnd). */
export function isMobileDriverLaneOpenForBookingSpan(
  jobs: MobileManagerJob[],
  slotDate: string,
  bookingStart: string,
  bookingEnd: string,
  laneNum: number,
  laneCount: number,
  gridRows: { startTime: string; endTime: string }[],
  exceptJobId?: string
): boolean {
  const b0 = parseTimeToMinutes(bookingStart);
  const b1 = parseTimeToMinutes(bookingEnd);
  if (b1 <= b0) return false;
  for (const row of gridRows) {
    const s0 = parseTimeToMinutes(row.startTime);
    if (s0 < b0 || s0 >= b1) continue;
    if (!isMobileDriverLaneOpen(jobs, slotDate, row.startTime, row.endTime, laneNum, laneCount, exceptJobId)) {
      return false;
    }
  }
  return true;
}

/** Best-guess lane for an existing booking when lane is not stored on the job. */
export function inferMobileDriverLaneForJob(
  jobs: MobileManagerJob[],
  job: MobileManagerJob,
  laneCount: number
): number {
  const others = countOverlappingMobileJobs(
    jobs,
    job.slotDate,
    job.startTime,
    job.endTime,
    job.id
  );
  return Math.min(Math.max(1, others + 1), Math.max(1, laneCount));
}
