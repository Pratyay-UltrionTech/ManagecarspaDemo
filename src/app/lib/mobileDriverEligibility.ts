import type { MobileManagerJob, MobileServiceStaff } from './mobileServicesStore';
import { normalizePinCode } from './mobileServicesStore';

const AU_STATE_POSTCODE = /\b(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})\b/i;

/** Extract postcode from a free-text or structured AU/international address. */
export function extractZipFromAddress(address: string): string {
  const s = String(address || '').trim();
  if (!s) return '';

  const withState = s.match(AU_STATE_POSTCODE);
  if (withState?.[1]) return withState[1];

  const tail = s.match(/[,\s]+(\d{4})\s*$/);
  if (tail?.[1]) return tail[1];

  const long = s.match(/\b(\d{5,6})\b/);
  if (long?.[1]) return long[1];

  const fourDigit = [...s.matchAll(/\b(\d{4})\b/g)];
  if (fourDigit.length) return fourDigit[fourDigit.length - 1]![1]!;

  return '';
}

/** Prefer postcode parsed from the visit address; fall back to stored requested zip. */
export function resolveBookingZipCode(
  job: { address?: string; requestedZipCode?: string },
  addressOverride?: string
): string {
  const fromAddress = extractZipFromAddress(addressOverride ?? job.address ?? '');
  if (fromAddress) return fromAddress;
  const requested = zipDigits(job.requestedZipCode || '');
  return requested || String(job.requestedZipCode ?? '').trim();
}

function zipDigits(z: string): string {
  return String(z ?? '').replace(/\D/g, '');
}

/**
 * True if driver may take this booking's postcode.
 * Matches backend `mobile_slot_service._driver_can_service_pin`:
 * - With a booking zip, only drivers who list that zip (or matching service pin) qualify.
 * - Empty serviceable list does NOT mean “all zips” unless `strict` is false (legacy).
 */
export function isDriverServiceableForZip(
  driver: MobileServiceStaff,
  bookingZip: string,
  options?: { strict?: boolean }
): boolean {
  const strict = options?.strict ?? true;
  const booking = zipDigits(bookingZip);
  if (!booking) return true;
  const svcPin = zipDigits(driver.servicePinCode || '');
  if (svcPin && svcPin === booking) return true;
  const explicit = (driver.serviceableZipCodes ?? []).map((z) => zipDigits(String(z))).filter(Boolean);
  if (explicit.length === 0) return !strict;
  return explicit.some((z) => z === booking);
}

/** Active drivers for a manager pin who can service the booking postcode. */
export function listMobileDriversForBookingZip(
  staff: MobileServiceStaff[],
  managerPin: string,
  bookingZip: string
): MobileServiceStaff[] {
  const mgrPin = normalizePinCode(managerPin);
  return staff
    .filter((d) => d.active && normalizePinCode(d.cityPinCode) === mgrPin)
    .filter((d) => isDriverServiceableForZip(d, bookingZip, { strict: true }))
    .sort((a, b) =>
      (a.empName || a.loginId || a.id).localeCompare(b.empName || b.loginId || b.id, undefined, {
        sensitivity: 'base',
      })
    );
}

export function isDriverBusyForWindow(
  jobs: MobileManagerJob[],
  slotDate: string,
  startTime: string,
  endTime: string,
  driverId: string,
  excludeJobId?: string
): boolean {
  return jobs.some(
    (j) =>
      j.id !== excludeJobId &&
      j.slotDate === slotDate &&
      !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status) &&
      j.assignedStaffId === driverId &&
      !(j.endTime <= startTime || j.startTime >= endTime)
  );
}
