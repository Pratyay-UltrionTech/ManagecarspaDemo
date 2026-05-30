/** Branch entity shapes and helpers. Runtime state for branches lives in React + the API (see useBranchStore). */

import type {
  AddonItem,
  DayTimePriceRule,
  LoyaltyProgramConfig,
  PromoCode,
  ServiceItem,
  VehicleServiceBlock,
} from './catalogShapeTypes';
import {
  WEEKDAYS,
  emptyLoyaltyProgramConfig,
  migrateLoyaltyProgramConfig,
  migrateServiceItem,
} from './catalogShapeTypes';
import type { SlotDayOverride } from './branchSlotSchedule';
import { intervalsOverlapHHMM } from './branchSlotSchedule';

/** Statuses that no longer occupy a bay/slot/capacity. */
const NON_OCCUPYING = new Set(['cancelled', 'completed', 'rejected', 'failed']);

export type {
  AddonItem,
  DayTimePriceRule,
  LoyaltyProgramConfig,
  PromoCode,
  ServiceItem,
  VehicleServiceBlock,
};
export { WEEKDAYS };

export interface Branch {
  id: string;
  name: string;
  /** Multiline street / area (no zip — use zipCode). */
  location: string;
  zipCode: string;
  bayCount: number;
  openTime: string;
  closeTime: string;
}

export interface BranchManager {
  id: string;
  name: string;
  /** Multiline address */
  address: string;
  zipCode: string;
  email: string;
  phone: string;
  /** Date of joining (ISO date string) */
  doj: string;
  loginId: string;
  password: string;
  /** When false, hidden from operational menus where applicable */
  active: boolean;
}

export interface Washer {
  id: string;
  name: string;
  /** Multiline address */
  address: string;
  zipCode: string;
  email: string;
  phone: string;
  doj: string;
  loginId: string;
  password: string;
  /** Single bay assignment, 1-based */
  assignedBay: number;
  active: boolean;
}

export interface FreeCoffeeRule {
  id: string;
  kind: 'on_service' | 'after_n_services';
  serviceName?: string;
  servicesCount?: number;
  notes: string;
}

export type BookingJobStatus =
  | 'scheduled'
  | 'assigned'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** A booked job at the branch (walk-in or otherwise) */
export interface BranchBookingJob {
  id: string;
  customerName: string;
  /** Customer / service location for the job */
  address: string;
  phone: string;
  vehicleType: string;
  /** Make/model of vehicle, e.g. "Toyota Corolla". Maps to backend vehicle_model. */
  vehicleName?: string;
  /** Vehicle registration plate, e.g. "ABC 123". */
  registrationNumber?: string;
  serviceSummary: string;
  /** Catalog service id when booked */
  serviceId?: string | null;
  /** Add-on ids selected at booking time (+30 min each server-side). */
  selectedAddonIds?: string[];
  slotDate: string;
  startTime: string;
  endTime: string;
  bayNumber: number | null;
  assignedWasherId: string | null;
  status: BookingJobStatus;
  source: 'walk_in' | 'online' | 'phone';
  notes: string;
  /** Manager-entered instructions shown to washer/driver. Separate from auto-generated service notes. */
  managerNotes?: string;
  /** Link to CustomerUser if known. */
  customerId?: string | null;
  /** Customer email for notifications. */
  email?: string;
  /** Customer gratuity in cents (online bookings). */
  tipCents?: number;
  /** Service + add-ons charged at booking in cents (excl. tip). */
  serviceChargedCents?: number;
  /** Payment method selected at booking time (e.g. "later", "card", "apple"). */
  paymentMethod?: string;
  createdAt: string;
}

function bookingUsesBay(jobBay: number | null, targetBay: number): boolean {
  if (jobBay == null) return true;
  return jobBay === targetBay;
}

export function findBookingForBayWindow(
  bookings: BranchBookingJob[],
  slotDate: string,
  startTime: string,
  endTime: string,
  bayNumber: number
): BranchBookingJob | undefined {
  return bookings.find(
    (j) =>
      j.slotDate === slotDate &&
      !NON_OCCUPYING.has(j.status) &&
      bookingUsesBay(j.bayNumber, bayNumber) &&
      intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)
  );
}

/** Washer IDs assigned to other (non-cancelled) bookings in the same date/time window. */
export function washerIdsBusyInSlot(
  bookings: BranchBookingJob[],
  slotDate: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Set<string> {
  const ids = new Set<string>();
  for (const b of bookings) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (NON_OCCUPYING.has(b.status)) continue;
    if (b.slotDate !== slotDate) continue;
    if (!intervalsOverlapHHMM(startTime, endTime, b.startTime, b.endTime)) continue;
    if (b.assignedWasherId) ids.add(b.assignedWasherId);
  }
  return ids;
}

/** Used when closing a bay for a recurring window — block if any future day still has a booking. */
export function hasBookingFromDateOnBayWindow(
  bookings: BranchBookingJob[],
  fromDateInclusive: string,
  startTime: string,
  endTime: string,
  bayNumber: number
): boolean {
  return bookings.some(
    (j) =>
      j.slotDate >= fromDateInclusive &&
      !NON_OCCUPYING.has(j.status) &&
      bookingUsesBay(j.bayNumber, bayNumber) &&
      intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)
  );
}

export function listBookingsInWindowFromDate(
  bookings: BranchBookingJob[],
  fromDateInclusive: string,
  startTime: string,
  endTime: string
): BranchBookingJob[] {
  return bookings.filter(
    (j) =>
      j.slotDate >= fromDateInclusive &&
      !NON_OCCUPYING.has(j.status) &&
      intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)
  );
}

export function listBookingsInWindowOnDate(
  bookings: BranchBookingJob[],
  slotDate: string,
  startTime: string,
  endTime: string
): BranchBookingJob[] {
  return bookings.filter(
    (j) =>
      j.slotDate === slotDate &&
      !NON_OCCUPYING.has(j.status) &&
      intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)
  );
}

export interface BranchData {
  branchManagers: BranchManager[];
  washers: Washer[];
  vehicleServices: VehicleServiceBlock[];
  branchAddons: AddonItem[];
  promotions: PromoCode[];
  dayTimePricing: DayTimePriceRule[];
  freeCoffeeRules: FreeCoffeeRule[];
  loyaltyProgram: LoyaltyProgramConfig;
  /**
   * Length of each bookable window (minutes). Day is split from branch open→close into consecutive
   * slots; each slot accepts up to `branch.bayCount` vehicles in parallel.
   */
  managerSlotDurationMinutes: number;
  /**
   * Optional per recurring time window (`HH:mm|HH:mm`): which bays accept bookings (same every day).
   * Index 0 = bay 1. Missing windows default to all bays open.
   */
  slotBayOpenByWindow?: Record<string, boolean[]>;
  /** Recurring: whole time window accepts bookings when true. Missing = active. */
  slotWindowActiveByKey?: Record<string, boolean>;
  /** Key `YYYY-MM-DD|start|end` — per-day slot + bay overrides. */
  slotDayStates?: Record<string, SlotDayOverride>;
  branchBookings: BranchBookingJob[];
}

export interface AppState {
  branches: Branch[];
  dataByBranchId: Record<string, BranchData>;
}

function emptyBranchData(): BranchData {
  return {
    branchManagers: [],
    washers: [],
    vehicleServices: [],
    branchAddons: [],
    promotions: [],
    dayTimePricing: [],
    freeCoffeeRules: [],
    loyaltyProgram: emptyLoyaltyProgramConfig(),
    managerSlotDurationMinutes: 60,
    slotBayOpenByWindow: undefined,
    slotWindowActiveByKey: undefined,
    slotDayStates: undefined,
    branchBookings: [],
  };
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateUuidLike(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes where crypto.randomUUID is unavailable.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Legacy single manager object (no id / zip / active). */
function migrateLegacyBranchManager(m: unknown): Omit<BranchManager, 'id' | 'zipCode' | 'active'> | undefined {
  if (!m || typeof m !== 'object') return undefined;
  const x = m as Record<string, unknown>;
  return {
    name: String(x.name ?? ''),
    address: String(x.address ?? ''),
    email: String(x.email ?? ''),
    phone: String(x.phone ?? ''),
    doj: String(x.doj ?? ''),
    loginId: String(x.loginId ?? ''),
    password: String(x.password ?? ''),
  };
}

function migrateBranchManagerRecord(x: unknown): BranchManager {
  if (!x || typeof x !== 'object') {
    return {
      id: generateId('bm'),
      name: '',
      address: '',
      zipCode: '',
      email: '',
      phone: '',
      doj: '',
      loginId: '',
      password: '',
      active: true,
    };
  }
  const o = x as Record<string, unknown>;
  return {
    id: String(o.id ?? generateId('bm')),
    name: String(o.name ?? ''),
    address: String(o.address ?? ''),
    zipCode: String(o.zipCode ?? ''),
    email: String(o.email ?? ''),
    phone: String(o.phone ?? ''),
    doj: String(o.doj ?? ''),
    loginId: String(o.loginId ?? ''),
    password: String(o.password ?? ''),
    active: o.active === false ? false : true,
  };
}

function migrateWasher(w: unknown): Washer {
  const x = w as Record<string, unknown>;
  const nums = x.assignedBayNumbers as number[] | undefined;
  const bay =
    typeof x.assignedBay === 'number'
      ? x.assignedBay
      : Array.isArray(nums) && nums.length
        ? nums[0]!
        : 1;
  return {
    id: String(x.id ?? generateId('ws')),
    name: String(x.name ?? ''),
    address: String(x.address ?? ''),
    zipCode: String(x.zipCode ?? ''),
    email: String(x.email ?? ''),
    phone: String(x.phone ?? ''),
    doj: String(x.doj ?? ''),
    loginId: String(x.loginId ?? ''),
    password: String(x.password ?? ''),
    assignedBay: bay,
    active: x.active === false ? false : true,
  };
}

function migrateService(s: unknown): ServiceItem {
  const x = s as Record<string, unknown>;
  const normalized = migrateServiceItem(s);
  if (!x.id) {
    return { ...normalized, id: generateId('sv') };
  }
  return normalized;
}

function migrateAddon(a: unknown): AddonItem {
  const x = a as Record<string, unknown>;
  const pts = x.descriptionPoints;
  return {
    id: String(x.id ?? generateId('ad')),
    name: String(x.name ?? ''),
    price: typeof x.price === 'number' ? x.price : parseFloat(String(x.price)) || 0,
    descriptionPoints: Array.isArray(pts)
      ? pts.map(String)
      : typeof pts === 'string'
        ? pts.split('\n').map((l) => l.trim()).filter(Boolean)
        : [],
    active: x.active === false ? false : true,
  };
}

function migratePromo(p: unknown): PromoCode {
  const x = p as Record<string, unknown>;
  const oldVehicles = x.vehicleTypes as string[] | undefined;
  return {
    id: String(x.id ?? generateId('pr')),
    codeName: String(x.codeName ?? ''),
    discountType: x.discountType === 'percentage' || x.discountType === 'flat' ? x.discountType : 'flat',
    discountValue:
      typeof x.discountValue === 'number'
        ? x.discountValue
        : parseFloat(String(x.discountValue)) || 0,
    validityStart: String(x.validityStart ?? ''),
    validityEnd: String(x.validityEnd ?? ''),
    maxUsesPerCustomer:
      typeof x.maxUsesPerCustomer === 'number'
        ? x.maxUsesPerCustomer
        : typeof x.maxUses === 'number'
          ? x.maxUses
          : parseInt(String(x.maxUsesPerCustomer ?? x.maxUses ?? 1), 10) || 1,
    applicableServiceIds: Array.isArray(x.applicableServiceIds)
      ? (x.applicableServiceIds as string[])
      : [],
    applicableVehicleTypes: Array.isArray(x.applicableVehicleTypes)
      ? (x.applicableVehicleTypes as string[])
      : Array.isArray(oldVehicles)
        ? oldVehicles
        : [],
  };
}

function migrateManagerSlotDurationMinutes(
  _d: Partial<BranchData> & { washSlotTemplates?: unknown[] }
): number {
  /** Branch manager portal uses fixed 1-hour bookable windows. */
  return 60;
}

function migrateBookingJob(b: unknown): BranchBookingJob {
  const x = b as Record<string, unknown>;
  const st = x.status;
  let status: BookingJobStatus = 'scheduled';
  if (
    st === 'assigned' ||
    st === 'arrived' ||
    st === 'checked_in' ||
    st === 'in_progress' ||
    st === 'completed' ||
    st === 'cancelled' ||
    st === 'scheduled'
  ) {
    status = st;
  } else if (st === 'booked') {
    status = 'scheduled';
  }
  const src = x.source;
  const source =
    src === 'online' || src === 'phone' || src === 'walk_in' ? src : 'walk_in';
  const bayRaw = x.bayNumber;
  const bayNum =
    bayRaw === null || bayRaw === undefined || bayRaw === ''
      ? null
      : typeof bayRaw === 'number'
        ? Math.max(1, Math.floor(bayRaw))
        : Math.max(1, parseInt(String(bayRaw), 10) || 1);
  const washerRaw = x.assignedWasherId;
  const washerId =
    washerRaw === null || washerRaw === undefined || washerRaw === ''
      ? null
      : String(washerRaw);
  return {
    id: String(x.id ?? generateId('jbk')),
    customerName: String(x.customerName ?? ''),
    address: String(x.address ?? x.customerAddress ?? ''),
    phone: String(x.phone ?? ''),
    vehicleType: String(x.vehicleType ?? ''),
    serviceSummary: String(x.serviceSummary ?? x.serviceDescription ?? ''),
    serviceId:
      x.serviceId == null || x.serviceId === ''
        ? null
        : typeof x.serviceId === 'string'
          ? x.serviceId
          : String(x.serviceId),
    selectedAddonIds: Array.isArray(x.selectedAddonIds)
      ? (x.selectedAddonIds as string[])
      : Array.isArray(x.selected_addon_ids)
        ? (x.selected_addon_ids as string[])
        : [],
    slotDate: String(x.slotDate ?? ''),
    startTime: String(x.startTime ?? ''),
    endTime: String(x.endTime ?? ''),
    bayNumber: bayNum,
    assignedWasherId: washerId,
    status,
    source,
    notes: String(x.notes ?? ''),
    tipCents: typeof x.tipCents === 'number' ? x.tipCents : Number(x.tipCents ?? 0) || 0,
    createdAt: String(x.createdAt ?? new Date().toISOString()),
  };
}

function migrateDayRule(r: unknown): DayTimePriceRule {
  const x = r as Record<string, unknown>;
  const oldVehicles = x.vehicleTypes as string[] | undefined;
  const priceOr = String(x.priceOrCoupon ?? '');
  const val =
    typeof x.discountValue === 'number'
      ? x.discountValue
      : parseFloat(priceOr.replace(/[^0-9.]/g, '')) || 0;
  return {
    id: String(x.id ?? generateId('dt')),
    title: String(x.title ?? x.label ?? ''),
    description: String(x.description ?? x.dayTimeNotes ?? x.criteriaNotes ?? ''),
    discountType:
      x.discountType === 'percentage' || x.discountType === 'flat' ? x.discountType : 'flat',
    discountValue: val,
    applicableServiceIds: Array.isArray(x.applicableServiceIds)
      ? (x.applicableServiceIds as string[])
      : [],
    applicableVehicleTypes: Array.isArray(x.applicableVehicleTypes)
      ? (x.applicableVehicleTypes as string[])
      : Array.isArray(oldVehicles)
        ? oldVehicles
        : [],
    applicableDays: Array.isArray(x.applicableDays) ? (x.applicableDays as string[]) : [],
    timeWindowStart: String(x.timeWindowStart ?? ''),
    timeWindowEnd: String(x.timeWindowEnd ?? ''),
    validityStart: String(x.validityStart ?? ''),
    validityEnd: String(x.validityEnd ?? ''),
  };
}

function migrateBranchData(raw: unknown): BranchData {
  if (!raw || typeof raw !== 'object') return emptyBranchData();
  const d = raw as Partial<BranchData>;

  const vehicleServices = (d.vehicleServices ?? []).map((block) => {
    const b = block as VehicleServiceBlock;
    return {
      vehicleType: String(b.vehicleType ?? ''),
      services: (b.services ?? []).map((s) => migrateService(s)),
      addons: (b.addons ?? []).map((a) => migrateAddon(a)),
    };
  });

  let branchManagers: BranchManager[] = [];
  const legacy = d as { branchManagers?: unknown; branchManager?: unknown };
  if (Array.isArray(legacy.branchManagers)) {
    branchManagers = legacy.branchManagers.map(migrateBranchManagerRecord);
  } else if (legacy.branchManager) {
    const base = migrateLegacyBranchManager(legacy.branchManager);
    if (base) {
      const o = legacy.branchManager as Record<string, unknown>;
      branchManagers = [
        {
          id: String(o.id ?? generateId('bm')),
          name: base.name,
          address: base.address,
          zipCode: String(o.zipCode ?? ''),
          email: base.email,
          phone: base.phone,
          doj: base.doj,
          loginId: base.loginId,
          password: base.password,
          active: true,
        },
      ];
    }
  }

  const rawBookings = (d as Partial<BranchData>).branchBookings;
  const branchBookings = Array.isArray(rawBookings) ? rawBookings.map(migrateBookingJob) : [];
  const managerSlotDurationMinutes = migrateManagerSlotDurationMinutes(
    d as Partial<BranchData> & { washSlotTemplates?: unknown[] }
  );

  let slotBayOpenByWindow: Record<string, boolean[]> | undefined;
  const rawMask = (d as Partial<BranchData>).slotBayOpenByWindow;
  if (rawMask && typeof rawMask === 'object' && !Array.isArray(rawMask)) {
    slotBayOpenByWindow = {};
    for (const [k, v] of Object.entries(rawMask)) {
      if (typeof k !== 'string' || !Array.isArray(v)) continue;
      slotBayOpenByWindow[k] = v.map((x) => x !== false && x !== 0 && x !== '0');
    }
  }

  let slotWindowActiveByKey: Record<string, boolean> | undefined;
  const rawWinAct = (d as Partial<BranchData>).slotWindowActiveByKey;
  if (rawWinAct && typeof rawWinAct === 'object' && !Array.isArray(rawWinAct)) {
    slotWindowActiveByKey = {};
    for (const [k, v] of Object.entries(rawWinAct)) {
      if (typeof k !== 'string') continue;
      slotWindowActiveByKey[k] = v !== false && v !== 0 && v !== '0';
    }
  }

  let slotDayStates: Record<string, SlotDayOverride> | undefined;
  const rawDay = (d as Partial<BranchData>).slotDayStates;
  if (rawDay && typeof rawDay === 'object' && !Array.isArray(rawDay)) {
    slotDayStates = {};
    for (const [k, v] of Object.entries(rawDay)) {
      if (typeof k !== 'string' || !v || typeof v !== 'object') continue;
      const x = v as Record<string, unknown>;
      const baysRaw = x.baysOpen;
      let baysOpen: boolean[] | undefined;
      if (Array.isArray(baysRaw)) {
        baysOpen = baysRaw.map((b) => b !== false && b !== 0 && b !== '0');
      }
      slotDayStates[k] = {
        slotActive: typeof x.slotActive === 'boolean' ? x.slotActive : undefined,
        baysOpen,
      };
    }
    if (Object.keys(slotDayStates).length === 0) slotDayStates = undefined;
  }

  return {
    branchManagers,
    washers: (d.washers ?? []).map(migrateWasher),
    vehicleServices,
    branchAddons: Array.isArray((d as Partial<BranchData>).branchAddons)
      ? (d as Partial<BranchData>).branchAddons!.map((a) => migrateAddon(a))
      : [],
    promotions: (d.promotions ?? []).map(migratePromo),
    dayTimePricing: (d.dayTimePricing ?? []).map(migrateDayRule),
    freeCoffeeRules: Array.isArray(d.freeCoffeeRules) ? d.freeCoffeeRules : [],
    loyaltyProgram: migrateLoyaltyProgramConfig((d as Partial<BranchData>).loyaltyProgram),
    managerSlotDurationMinutes,
    slotBayOpenByWindow,
    slotWindowActiveByKey,
    slotDayStates,
    branchBookings,
  };
}

export function getBranchData(state: AppState, branchId: string): BranchData {
  const d = state.dataByBranchId[branchId];
  if (d) return d;
  return emptyBranchData();
}

/** All services with stable ids for promos / day pricing dropdowns */
export function findCatalogServiceById(data: BranchData, serviceId: string): ServiceItem | undefined {
  for (const vb of data.vehicleServices) {
    const s = vb.services.find((x) => x.id === serviceId);
    if (s) return s;
  }
  return undefined;
}

/** Label for promo/day-pricing tables: vehicle row + service name + price. */
export function serviceVariantLabel(data: BranchData, serviceId: string): string {
  for (const vb of data.vehicleServices) {
    const s = vb.services.find((x) => x.id === serviceId);
    if (s) return `${s.name} · ${vb.vehicleType} ($${s.price.toFixed(2)})`;
  }
  return serviceId;
}

/** Vehicle types implied by selected catalog service ids (for API fields). */
export function vehicleTypesForSelectedServices(data: BranchData, serviceIds: string[]): string[] {
  const seen = new Set<string>();
  for (const id of serviceIds) {
    for (const vb of data.vehicleServices) {
      if (vb.services.some((s) => s.id === id)) {
        seen.add(vb.vehicleType);
        break;
      }
    }
  }
  return Array.from(seen);
}

export function listServiceOptions(data: BranchData): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const vb of data.vehicleServices) {
    for (const s of vb.services) {
      out.push({ id: s.id, label: s.name });
    }
  }
  return out;
}

/** Services for one vehicle type only (manager create booking). */
export function listServiceOptionsForVehicle(
  data: BranchData,
  vehicleType: string
): { id: string; label: string }[] {
  const vb = data.vehicleServices.find((v) => v.vehicleType === vehicleType);
  if (!vb) return [];
  return vb.services
    .filter((s) => s.active !== false)
    .map((s) => ({ id: s.id, label: `${s.name} $${s.price.toFixed(2)}` }));
}

/**
 * All branch catalog services for loyalty **reward** pickers (active and inactive).
 * Spend totals for slabs must sum only prices where `eligibleForLoyaltyPoints` is true — see
 * `servicePriceCountsTowardLoyalty` in catalogShapeTypes.
 */
export function listLoyaltyRewardServiceOptions(data: BranchData): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const vb of data.vehicleServices) {
    for (const s of vb.services) {
      const suffix = !s.active ? ' (inactive)' : '';
      out.push({ id: s.id, label: `${s.name} $${s.price.toFixed(2)}${suffix}` });
    }
  }
  return out;
}

export function listVehicleTypes(data: BranchData): string[] {
  return data.vehicleServices.map((v) => v.vehicleType).filter(Boolean);
}

export const branchStoreApi = {
  generateBranchId: () => generateId('br'),
  generateBranchManagerId: () => generateId('bm'),
  generateWasherId: () => generateId('ws'),
  generateServiceId: () => generateId('sv'),
  generateAddonId: () => generateId('ad'),
  generatePromoId: () => generateId('pr'),
  generateDayPriceId: () => generateId('dt'),
  generateCoffeeId: () => generateId('fc'),
  generateLoyaltyTierId: () => generateId('loy'),
  generateBookingJobId: () => generateUuidLike(),
  emptyBranchData,
};
