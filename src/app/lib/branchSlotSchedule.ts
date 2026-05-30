/** Minutes since midnight for "HH:mm" (24h). */
export function parseTimeToMinutes(t: string): number {
  const parts = t.split(':').map((x) => parseInt(String(x).trim(), 10));
  const h = Number.isFinite(parts[0]) ? parts[0]! : 0;
  const m = Number.isFinite(parts[1]) ? parts[1]! : 0;
  return ((h * 60 + m) % (24 * 60) + 24 * 60) % (24 * 60);
}

export function formatMinutesToHHMM(total: number): string {
  const m = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function minutesBetween(startHHMM: string, endHHMM: string): number {
  return Math.max(0, parseTimeToMinutes(endHHMM) - parseTimeToMinutes(startHHMM));
}

/** Base scheduling grid step (must match backend). */
export const BASE_SLOT_MINUTES = 30;

/** Match backend ``duration_slots.snap_duration_to_base_slots`` (round up to 30-minute slots). */
export function snapDurationToBaseSlotsMinutes(minutes: number): number {
  const m = Math.max(BASE_SLOT_MINUTES, Math.round(Number(minutes) || 0));
  const rem = m % BASE_SLOT_MINUTES;
  return rem ? m + BASE_SLOT_MINUTES - rem : m;
}

/** Match backend ``total_minutes_for_service_and_addons`` (snapped service length + 30 min per add-on). */
export function totalMinutesForServiceAndAddons(
  serviceDurationMinutes: number | null | undefined,
  addonCount: number
): number {
  const raw = Math.max(BASE_SLOT_MINUTES, Number(serviceDurationMinutes ?? 60) || 60);
  const base = snapDurationToBaseSlotsMinutes(raw);
  return base + Math.max(0, addonCount) * BASE_SLOT_MINUTES;
}

/** Booking end time (HH:mm) from catalog service duration, add-on count, and start time. */
export function branchBookingEndHHMM(
  startHHMM: string,
  serviceDurationMinutes: number | null | undefined,
  addonCount: number
): string {
  const mins = totalMinutesForServiceAndAddons(serviceDurationMinutes, addonCount);
  return formatMinutesToHHMM(parseTimeToMinutes(startHHMM) + mins);
}

/** Half-open interval overlap in minutes (handles end before start as next day). */
export function intervalsOverlapHHMM(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  let a0 = parseTimeToMinutes(aStart);
  let a1 = parseTimeToMinutes(aEnd);
  let b0 = parseTimeToMinutes(bStart);
  let b1 = parseTimeToMinutes(bEnd);
  if (a1 <= a0) a1 += 24 * 60;
  if (b1 <= b0) b1 += 24 * 60;
  return a0 < b1 && b0 < a1;
}

/** One bookable row: all bays are free for this window, so up to `maxConcurrentVehicles` bookings. */
export interface GeneratedDaySlot {
  startTime: string;
  endTime: string;
  maxConcurrentVehicles: number;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export function normalizeSlotDurationMinutes(raw: number): number {
  if (!Number.isFinite(raw) || raw < 15) return 60;
  const capped = Math.min(480, Math.round(raw));
  const snapped = Math.round(capped / 15) * 15;
  return Math.max(15, snapped);
}

export function slotDurationSelectOptions(): readonly number[] {
  return DURATION_OPTIONS;
}

/**
 * Build consecutive slots from open → close. Each slot allows `bayCount` vehicles in parallel (one
 * per bay). Same pattern every calendar day.
 */
/** Stable key for a recurring day slot (`start|end`, 24h HH:mm). */
export function slotWindowKey(startTime: string, endTime: string): string {
  return `${startTime}|${endTime}`;
}

export function defaultBayOpenMask(bayCount: number): boolean[] {
  const n = Math.max(1, bayCount);
  return Array.from({ length: n }, () => true);
}

/**
 * Per-window bay availability for booking. Missing key = all bays open.
 * Arrays are trimmed/padded to `bayCount`; extra indices default to open.
 */
export function getBayOpenMaskForWindow(
  slotBayOpenByWindow: Record<string, boolean[]> | undefined,
  windowKey: string,
  bayCount: number
): boolean[] {
  const n = Math.max(1, bayCount);
  const out = defaultBayOpenMask(n);
  const stored = slotBayOpenByWindow?.[windowKey];
  if (!stored?.length) return out;
  for (let i = 0; i < n; i++) {
    out[i] = i < stored.length ? Boolean(stored[i]) : true;
  }
  return out;
}

export function countOpenBaysInMask(mask: boolean[]): number {
  return mask.filter(Boolean).length;
}

/** Per-calendar-day override for one time window (`date|start|end` key). */
export interface SlotDayOverride {
  slotActive?: boolean;
  baysOpen?: boolean[];
}

export interface SlotScheduleSlice {
  slotWindowActiveByKey?: Record<string, boolean>;
  slotBayOpenByWindow?: Record<string, boolean[]>;
  slotDayStates?: Record<string, SlotDayOverride>;
}

export function dayWindowKey(isoDate: string, windowKey: string): string {
  return `${isoDate}|${windowKey}`;
}

/** Recurring pattern only (ignores per-date overrides). */
export function getRecurringSlotState(
  slice: SlotScheduleSlice,
  windowKey: string,
  bayCount: number
): { slotActive: boolean; baysOpen: boolean[] } {
  const n = Math.max(1, bayCount);
  const slotActive = slice.slotWindowActiveByKey?.[windowKey] !== false;
  const bays = getBayOpenMaskForWindow(slice.slotBayOpenByWindow, windowKey, n);
  if (!slotActive) {
    return { slotActive: false, baysOpen: defaultBayOpenMask(n).map(() => false) };
  }
  return { slotActive: true, baysOpen: bays };
}

/**
 * Effective slot + bay mask for a calendar day (recurring + optional `slotDayStates[date|windowKey]`).
 * When `ignoreDayKey` matches the computed day key, that day row is ignored (used while rebuilding a day override).
 */
export function getEffectiveSlotState(
  slice: SlotScheduleSlice,
  isoDate: string,
  windowKey: string,
  bayCount: number,
  ignoreDayKey?: string
): { slotActive: boolean; baysOpen: boolean[] } {
  const n = Math.max(1, bayCount);
  const dk = dayWindowKey(isoDate, windowKey);
  const recurring = getRecurringSlotState(slice, windowKey, n);
  const day = slice.slotDayStates?.[dk];
  if (!day || dk === ignoreDayKey) {
    return recurring;
  }
  let slotActive = recurring.slotActive;
  if (typeof day.slotActive === 'boolean') {
    slotActive = day.slotActive;
  }
  let bays = recurring.baysOpen;
  if (Array.isArray(day.baysOpen) && day.baysOpen.length === n) {
    bays = day.baysOpen.map((x) => x !== false);
  } else if (Array.isArray(day.baysOpen)) {
    bays = bays.map((b, i) => b && (i < day.baysOpen!.length ? day.baysOpen![i] !== false : true));
  }
  if (!slotActive) {
    return { slotActive: false, baysOpen: defaultBayOpenMask(n).map(() => false) };
  }
  return { slotActive: true, baysOpen: bays };
}

export function generateOperatingDaySlots(
  openTime: string,
  closeTime: string,
  bayCount: number,
  _durationMinutesLegacy: number
): GeneratedDaySlot[] {
  const dur = BASE_SLOT_MINUTES;
  const open = parseTimeToMinutes(openTime);
  const close = parseTimeToMinutes(closeTime);
  let closeAbs = close;
  const openAbs = open;
  if (closeAbs <= openAbs) {
    closeAbs += 24 * 60;
  }
  const bays = Math.max(1, bayCount);
  const slots: GeneratedDaySlot[] = [];
  for (let t = openAbs; t + dur <= closeAbs; t += dur) {
    slots.push({
      startTime: formatMinutesToHHMM(t % (24 * 60)),
      endTime: formatMinutesToHHMM((t + dur) % (24 * 60)),
      maxConcurrentVehicles: bays,
    });
  }
  return slots;
}
