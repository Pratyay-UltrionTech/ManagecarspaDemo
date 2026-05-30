import type { BookingJobStatus, BranchBookingJob } from '../../../lib/branchStore';

const VALID: BookingJobStatus[] = [
  'scheduled',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
];

export function normalizeEditableStatus(status: BookingJobStatus): BookingJobStatus {
  if (status === 'checked_in') return 'in_progress';
  return VALID.includes(status) ? status : 'scheduled';
}

export function bookingConflict(
  bookings: BranchBookingJob[],
  excludeId: string,
  slotDate: string,
  startTime: string,
  endTime: string,
  bayNumber: number
): BranchBookingJob | undefined {
  return bookings.find(
    (j) =>
      j.id !== excludeId &&
      j.slotDate === slotDate &&
      j.startTime === startTime &&
      j.endTime === endTime &&
      j.bayNumber === bayNumber &&
      !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status)
  );
}
