import type { BookingJobStatus } from '../../../lib/branchStore';

export const STATUS_OPTIONS: { value: BookingJobStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Full lifecycle (washer + manager updates). */
export const ALL_STATUS_OPTIONS: { value: BookingJobStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const CUSTOM_SERVICE = '__custom_service__';
