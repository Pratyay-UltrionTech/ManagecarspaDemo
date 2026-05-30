/** Mobile managers (one per city PIN) and mobile staff under them (+ service PIN). Not linked to fixed branches. */

import type {
  AddonItem,
  DayTimePriceRule,
  LoyaltyProgramConfig,
  PromoCode,
  ServiceItem,
  VehicleServiceBlock,
} from './catalogShapeTypes';
import {
  emptyLoyaltyProgramConfig,
  migrateAddonItem,
  migrateLoyaltyProgramConfig,
  migrateServiceItem,
} from './catalogShapeTypes';
import {
  dayWindowKey,
  intervalsOverlapHHMM,
  normalizeSlotDurationMinutes,
  slotWindowKey,
} from './branchSlotSchedule';

/** Isolated from `carwash_admin_static_v1` (branch store). */
const STORAGE_KEY = 'carwash_mobile_services_v4';
const LEGACY_KEYS = [
  'carwash_mobile_services_v3',
  'carwash_mobile_services_v2',
  'carwash_mobile_services_v1',
] as const;

export interface MobileServiceManager {
  id?: string;
  pinCode: string;
  empName: string;
  /** Multiline address */
  address: string;
  zipCode: string;
  email: string;
  mobile: string;
  doj: string;
  loginId: string;
  password: string;
  active: boolean;
}

export interface MobileServiceStaff {
  id: string;
  /** City PIN — must match a mobile manager */
  cityPinCode: string;
  /** Service area / operational PIN (separate from city PIN) */
  servicePinCode: string;
  empName: string;
  /** Multiline address */
  address: string;
  /** Postal / ZIP for staff address */
  zipCode: string;
  /** Areas this staff can service (postal/ZIP codes, one per line or comma-separated in forms) */
  serviceableZipCodes: string[];
  email: string;
  mobile: string;
  doj: string;
  loginId: string;
  password: string;
  active: boolean;
}

export type MobileManagerJobStatus =
  | 'scheduled'
  | 'assigned'
  | 'arrived'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface MobileManagerJob {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  /** Make/model of vehicle, e.g. "Toyota Corolla". Maps to backend vehicle_model. */
  vehicleName?: string;
  /** Vehicle registration plate, e.g. "ABC 123". */
  registrationNumber?: string;
  /** Legacy combined field; prefer serviceId + vehicleType when set */
  vehicleSummary: string;
  address: string;
  /** Selected catalog service id (mobile vehicleCatalog) */
  serviceId: string | null;
  vehicleType: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  assignedStaffId: string | null;
  status: MobileManagerJobStatus;
  notes: string;
  /** Manager-entered instructions shown to driver. Separate from auto-generated service notes. */
  managerNotes?: string;
  selectedAddonIds?: string[];
  tipCents?: number;
  serviceChargedCents?: number;
  customerId?: string | null;
  createdAt: string;
  requestedZipCode?: string;
}

/** Per-day override for a time window (`yyyy-MM-dd|HH:mm|HH:mm`). */
export interface MobileSlotDayOverride {
  slotActive?: boolean;
  driversOpen?: boolean[];
}

/** Per city-PIN scheduling: slot grid settings and field jobs for mobile managers. */
export interface MobileOpsForPin {
  slotDurationMinutes: number;
  openTime: string;
  closeTime: string;
  jobs: MobileManagerJob[];
  /** Recurring: `HH:mm|HH:mm` → false closes that window every day unless day override. */
  slotWindowActiveByKey?: Record<string, boolean>;
  /** Recurring: `HH:mm|HH:mm` -> driver capacity mask for this window. */
  slotDriverOpenByWindow?: Record<string, boolean[]>;
  /** Per calendar day overrides for a window key. */
  slotDayStates?: Record<string, MobileSlotDayOverride>;
}

export interface MobileServicesState {
  managersByPin: Record<string, MobileServiceManager>;
  staff: MobileServiceStaff[];
  /** Vehicle types and services for mobile only (no branch linkage). */
  vehicleCatalog: VehicleServiceBlock[];
  /** Add-ons available for every mobile vehicle type (like branch-wide add-ons). */
  mobileAddons: AddonItem[];
  promotions: PromoCode[];
  dayTimePricing: DayTimePriceRule[];
  loyaltyProgram: LoyaltyProgramConfig;
  /** Mobile manager portal: slots + jobs keyed by city PIN (same key as managersByPin). */
  mobileOpsByPin: Record<string, MobileOpsForPin>;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizePinCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/** City / service PIN: 4-6 digits. */
export function isValidPinCode(pin: string): boolean {
  const n = normalizePinCode(pin).length;
  return n >= 4 && n <= 6;
}

function isJobStatus(x: unknown): x is MobileManagerJobStatus {
  return (
    x === 'scheduled' ||
    x === 'assigned' ||
    x === 'arrived' ||
    x === 'checked_in' ||
    x === 'in_progress' ||
    x === 'completed' ||
    x === 'cancelled'
  );
}

/** Manager-created bookings with a driver should present as assigned, not scheduled. */
export function normalizeMobileManagerJobStatus(
  rawStatus: unknown,
  assignedStaffId: string | null | undefined,
): MobileManagerJobStatus {
  const s = String(rawStatus ?? 'scheduled').trim().toLowerCase();
  let status: MobileManagerJobStatus =
    s === 'booked' ? 'scheduled' : isJobStatus(s) ? s : 'scheduled';
  const staffId =
    assignedStaffId == null || assignedStaffId === '' || assignedStaffId === 'none'
      ? null
      : String(assignedStaffId);
  if (staffId && status === 'scheduled') status = 'assigned';
  return status;
}

function migrateMobileJob(j: unknown): MobileManagerJob | null {
  const x = j as Record<string, unknown>;
  if (!x?.id || !x.slotDate) return null;
  const assignedStaffId =
    x.assignedStaffId == null || x.assignedStaffId === '' ? null : String(x.assignedStaffId);
  const status = normalizeMobileManagerJobStatus(x.status, assignedStaffId);
  const serviceRaw = x.serviceId;
  return {
    id: String(x.id),
    customerName: String(x.customerName ?? ''),
    phone: String(x.phone ?? ''),
    vehicleSummary: String(x.vehicleSummary ?? x.vehicleType ?? ''),
    address: String(x.address ?? ''),
    serviceId: serviceRaw == null || serviceRaw === '' ? null : String(serviceRaw),
    vehicleType: String(x.vehicleType ?? ''),
    vehicleName: String(x.vehicleName ?? x.vehicle_model ?? ''),
    registrationNumber: String(x.registrationNumber ?? x.registration_number ?? ''),
    slotDate: String(x.slotDate),
    startTime: String(x.startTime ?? ''),
    endTime: String(x.endTime ?? ''),
    assignedStaffId,
    status,
    notes: String(x.notes ?? ''),
    managerNotes: String(x.managerNotes ?? x.manager_notes ?? ''),
    selectedAddonIds: Array.isArray(x.selectedAddonIds)
      ? (x.selectedAddonIds as string[])
      : Array.isArray(x.selected_addon_ids)
        ? (x.selected_addon_ids as string[])
        : [],
    tipCents: typeof x.tipCents === 'number' ? x.tipCents : Number(x.tip_cents ?? x.tipCents ?? 0) || 0,
    createdAt: String(x.createdAt ?? x.created_at ?? new Date().toISOString()),
    requestedZipCode: String(x.requestedZipCode ?? x.requested_zip_code ?? ''),
  };
}

function migrateRecordBoolMap(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function migrateRecordBoolArrayMap(raw: unknown): Record<string, boolean[]> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, boolean[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    out[k] = v.map((x) => x !== false && x !== 0 && x !== '0');
  }
  return Object.keys(out).length ? out : undefined;
}

function migrateSlotDayStates(raw: unknown): Record<string, MobileSlotDayOverride> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, MobileSlotDayOverride> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const driversOpen = Array.isArray(o.driversOpen)
      ? o.driversOpen.map((x) => x !== false && x !== 0 && x !== '0')
      : undefined;
    if (typeof o.slotActive === 'boolean' || driversOpen) {
      out[k] = { slotActive: typeof o.slotActive === 'boolean' ? o.slotActive : undefined, driversOpen };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function migrateMobileOpsBlock(raw: unknown): MobileOpsForPin {
  if (!raw || typeof raw !== 'object') return emptyMobileOpsForPin();
  const x = raw as Record<string, unknown>;
  const durRaw = Number(x.slotDurationMinutes);
  const jobs = Array.isArray(x.jobs)
    ? (x.jobs.map(migrateMobileJob).filter(Boolean) as MobileManagerJob[])
    : [];
  return {
    slotDurationMinutes: normalizeSlotDurationMinutes(Number.isFinite(durRaw) ? durRaw : 60),
    openTime: String(x.openTime ?? '08:00').slice(0, 5) || '08:00',
    closeTime: String(x.closeTime ?? '18:00').slice(0, 5) || '18:00',
    jobs,
    slotWindowActiveByKey: migrateRecordBoolMap(x.slotWindowActiveByKey),
    slotDriverOpenByWindow: migrateRecordBoolArrayMap(x.slotDriverOpenByWindow),
    slotDayStates: migrateSlotDayStates(x.slotDayStates),
  };
}

export function getMobileOpsForPin(state: MobileServicesState, cityPin: string): MobileOpsForPin {
  const pin = normalizePinCode(cityPin);
  return state.mobileOpsByPin[pin] ?? emptyMobileOpsForPin();
}

export function countActiveMobileDriversForPin(
  staff: MobileServiceStaff[],
  cityPin: string
): number {
  const pin = normalizePinCode(cityPin);
  return staff.filter((s) => normalizePinCode(s.cityPinCode) === pin && s.active).length;
}

export function findMobileManagerByCredentials(
  managersByPin: Record<string, MobileServiceManager>,
  loginIdRaw: string,
  password: string
): { pin: string; manager: MobileServiceManager } | 'none' | 'ambiguous' {
  const lid = loginIdRaw.trim();
  if (!lid || !password) return 'none';
  const matches: { pin: string; manager: MobileServiceManager }[] = [];
  for (const mgr of Object.values(managersByPin)) {
    if (!mgr.active) continue;
    if (mgr.loginId.trim() === lid && mgr.password === password) {
      matches.push({ pin: normalizePinCode(mgr.pinCode), manager: mgr });
    }
  }
  if (matches.length === 0) return 'none';
  if (matches.length > 1) return 'ambiguous';
  return matches[0]!;
}

export function emptyMobileOpsForPin(): MobileOpsForPin {
  return {
    slotDurationMinutes: 60,
    openTime: '08:00',
    closeTime: '18:00',
    jobs: [],
    slotWindowActiveByKey: undefined,
    slotDriverOpenByWindow: undefined,
    slotDayStates: undefined,
  };
}

function defaultDriverOpenMask(driverCount: number): boolean[] {
  const n = Math.max(1, driverCount);
  return Array.from({ length: n }, () => true);
}

export function getEffectiveMobileSlotState(
  ops: MobileOpsForPin,
  isoDate: string,
  startTime: string,
  endTime: string,
  driverCount: number
): { slotActive: boolean; driversOpen: boolean[] } {
  const n = Math.max(1, driverCount);
  const wk = slotWindowKey(startTime, endTime);
  let slotActive = ops.slotWindowActiveByKey?.[wk] !== false;
  const driversOpen = defaultDriverOpenMask(n);
  const recurringDrivers = ops.slotDriverOpenByWindow?.[wk];
  if (Array.isArray(recurringDrivers)) {
    for (let i = 0; i < n; i++) {
      driversOpen[i] = i < recurringDrivers.length ? recurringDrivers[i] !== false : true;
    }
  }
  const dk = dayWindowKey(isoDate, wk);
  const day = ops.slotDayStates?.[dk];
  if (typeof day?.slotActive === 'boolean') slotActive = day.slotActive;
  if (Array.isArray(day?.driversOpen)) {
    for (let i = 0; i < n; i++) {
      driversOpen[i] = i < day.driversOpen.length ? day.driversOpen[i] !== false : driversOpen[i];
    }
  }
  if (!slotActive) {
    return { slotActive: false, driversOpen: driversOpen.map(() => false) };
  }
  return { slotActive: driversOpen.some(Boolean), driversOpen };
}

/** Effective slot window on for a calendar day (recurring + day override). */
export function getEffectiveMobileSlotWindowActive(
  ops: MobileOpsForPin,
  isoDate: string,
  startTime: string,
  endTime: string,
  driverCount = 1
): boolean {
  return getEffectiveMobileSlotState(ops, isoDate, startTime, endTime, driverCount).slotActive;
}

export function countMobileJobsInWindow(
  jobs: MobileManagerJob[],
  date: string,
  startTime: string,
  endTime: string
): number {
  const seen = new Set<string>();
  for (const j of jobs) {
    if (j.slotDate !== date || ['cancelled', 'completed', 'rejected', 'failed'].includes(j.status)) continue;
    if (intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)) seen.add(j.id);
  }
  return seen.size;
}

export function findMobileCatalogServiceById(
  catalog: VehicleServiceBlock[],
  serviceId: string
): ServiceItem | undefined {
  for (const vb of catalog) {
    const s = vb.services.find((x) => x.id === serviceId);
    if (s) return s;
  }
  return undefined;
}

function emptyState(): MobileServicesState {
  return {
    managersByPin: {},
    staff: [],
    vehicleCatalog: [],
    mobileAddons: [],
    promotions: [],
    dayTimePricing: [],
    loyaltyProgram: emptyLoyaltyProgramConfig(),
    mobileOpsByPin: {},
  };
}

export function listMobileServiceOptions(catalog: VehicleServiceBlock[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const vb of catalog) {
    for (const s of vb.services) {
      out.push({ id: s.id, label: s.name });
    }
  }
  return out;
}

export function listMobileServiceOptionsForVehicle(
  catalog: VehicleServiceBlock[],
  vehicleType: string
): { id: string; label: string }[] {
  const vb = catalog.find((v) => v.vehicleType === vehicleType);
  if (!vb) return [];
  return vb.services
    .filter((s) => s.active !== false)
    .map((s) => ({ id: s.id, label: `${s.name} $${s.price.toFixed(2)}` }));
}

export function listMobileVehicleTypes(catalog: VehicleServiceBlock[]): string[] {
  return catalog.map((v) => v.vehicleType).filter(Boolean);
}

/** Label for a catalog service line including vehicle type and price (promo / day-time tables). */
export function mobileServiceVariantLabel(catalog: VehicleServiceBlock[], serviceId: string): string {
  for (const vb of catalog) {
    const s = vb.services.find((x) => x.id === serviceId);
    if (s) return `${s.name} · ${vb.vehicleType} ($${s.price.toFixed(2)})`;
  }
  return serviceId;
}

/** Vehicle types implied by selected mobile catalog service ids (API / stored promos). */
export function vehicleTypesForSelectedMobileServices(
  catalog: VehicleServiceBlock[],
  serviceIds: string[],
): string[] {
  const seen = new Set<string>();
  for (const id of serviceIds) {
    for (const vb of catalog) {
      if (vb.services.some((s) => s.id === id)) {
        seen.add(vb.vehicleType);
        break;
      }
    }
  }
  return Array.from(seen);
}

/** All mobile catalog services for loyalty reward pickers (active and inactive). */
export function listLoyaltyRewardMobileServiceOptions(
  catalog: VehicleServiceBlock[]
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const vb of catalog) {
    for (const s of vb.services) {
      const suffix = !s.active ? ' (inactive)' : '';
      out.push({ id: s.id, label: `${s.name} $${s.price.toFixed(2)}${suffix}` });
    }
  }
  return out;
}

function migrateManager(m: unknown, pin: string): MobileServiceManager {
  const x = m as Record<string, unknown>;
  return {
    id: x.id ? String(x.id) : undefined,
    pinCode: pin,
    empName: String(x.empName ?? ''),
    address: String(x.address ?? ''),
    zipCode: String(x.zipCode ?? ''),
    email: String(x.email ?? ''),
    mobile: String(x.mobile ?? ''),
    doj: String(x.doj ?? ''),
    loginId: String(x.loginId ?? ''),
    password: String(x.password ?? ''),
    active: x.active === false ? false : true,
  };
}

function migrateStaffRow(s: unknown, defaultCityPin: string): MobileServiceStaff {
  const x = s as Record<string, unknown>;
  const city = normalizePinCode(String(x.cityPinCode ?? defaultCityPin));
  const pin = isValidPinCode(city) ? city : normalizePinCode(defaultCityPin);
  let svc = normalizePinCode(String(x.servicePinCode ?? x.servicePin ?? ''));
  if (!isValidPinCode(svc)) svc = pin;
  const rawZips = x.serviceableZipCodes;
  let serviceableZipCodes: string[] = [];
  if (Array.isArray(rawZips)) {
    serviceableZipCodes = rawZips.map(String).map((z) => z.trim()).filter(Boolean);
  } else if (typeof rawZips === 'string') {
    serviceableZipCodes = rawZips
      .split(/[\n,]+/)
      .map((z) => z.trim())
      .filter(Boolean);
  }
  return {
    id: String(x.id ?? generateId('mss')),
    cityPinCode: pin,
    servicePinCode: svc,
    empName: String(x.empName ?? ''),
    address: String(x.address ?? ''),
    zipCode: String(x.zipCode ?? ''),
    serviceableZipCodes,
    email: String(x.email ?? ''),
    mobile: String(x.mobile ?? ''),
    doj: String(x.doj ?? ''),
    loginId: String(x.loginId ?? ''),
    password: String(x.password ?? ''),
    active: x.active === false ? false : true,
  };
}

/** Legacy v1: branches[] with pinCode, manager, staff[] */
function migrateFromV1Branches(branches: unknown[]): MobileServicesState {
  const managersByPin: Record<string, MobileServiceManager> = {};
  const staff: MobileServiceStaff[] = [];
  for (const b of branches) {
    const x = b as Record<string, unknown>;
    const pin = normalizePinCode(String(x.pinCode ?? ''));
    if (!isValidPinCode(pin)) continue;
    if (x.manager && typeof x.manager === 'object') {
      managersByPin[pin] = migrateManager(x.manager, pin);
    }
    const list = Array.isArray(x.staff) ? x.staff : [];
    for (const s of list) {
      staff.push(migrateStaffRow(s, pin));
    }
  }
  return {
    managersByPin,
    staff,
    vehicleCatalog: [],
    mobileAddons: [],
    promotions: [],
    dayTimePricing: [],
    loyaltyProgram: emptyLoyaltyProgramConfig(),
    mobileOpsByPin: {},
  };
}

function migrateParsedShape(
  p: Partial<MobileServicesState> & { branches?: unknown[] }
): MobileServicesState {
  // Legacy mobile v1 was only `{ branches: [...] }`. Do not treat `branches` as authoritative
  // if we already have mobile v2+ fields (avoids branch-app JSON pasted into mobile storage).
  const hasModernMobileFields =
    p &&
    typeof p === 'object' &&
    ('managersByPin' in p ||
      'vehicleCatalog' in p ||
      'mobileAddons' in p ||
      'promotions' in p ||
      'dayTimePricing' in p ||
      'loyaltyProgram' in p ||
      'staff' in p);

  if (Array.isArray(p.branches) && !hasModernMobileFields) {
    return migrateFromV1Branches(p.branches);
  }

  const managersByPin: Record<string, MobileServiceManager> = {};
  if (p.managersByPin && typeof p.managersByPin === 'object') {
    for (const [k, v] of Object.entries(p.managersByPin)) {
      const pin = normalizePinCode(k);
      if (isValidPinCode(pin) && v && typeof v === 'object') {
        managersByPin[pin] = migrateManager(v, pin);
      }
    }
  }

  let staff: MobileServiceStaff[] = Array.isArray(p.staff)
    ? p.staff.map((s) => {
        const x = s as Record<string, unknown>;
        const city = normalizePinCode(String(x.cityPinCode ?? ''));
        let svc = normalizePinCode(String(x.servicePinCode ?? ''));
        if (!isValidPinCode(city)) {
          return null;
        }
        if (!isValidPinCode(svc)) svc = city;
        const rawZips = x.serviceableZipCodes;
        let serviceableZipCodes: string[] = [];
        if (Array.isArray(rawZips)) {
          serviceableZipCodes = rawZips.map(String).map((z) => z.trim()).filter(Boolean);
        } else if (typeof rawZips === 'string') {
          serviceableZipCodes = rawZips
            .split(/[\n,]+/)
            .map((z) => z.trim())
            .filter(Boolean);
        }
        return {
          id: String(x.id ?? generateId('mss')),
          cityPinCode: city,
          servicePinCode: svc,
          empName: String(x.empName ?? ''),
          address: String(x.address ?? ''),
          zipCode: String(x.zipCode ?? ''),
          serviceableZipCodes,
          email: String(x.email ?? ''),
          mobile: String(x.mobile ?? ''),
          doj: String(x.doj ?? ''),
          loginId: String(x.loginId ?? ''),
          password: String(x.password ?? ''),
          active: x.active === false ? false : true,
        };
      })
    : [];

  staff = staff.filter((s): s is MobileServiceStaff => s !== null);
  staff = staff.filter((s) => managersByPin[s.cityPinCode]);

  const rawBlocks = Array.isArray(p.vehicleCatalog) ? (p.vehicleCatalog as VehicleServiceBlock[]) : [];
  const addonById = new Map<string, AddonItem>();
  for (const block of rawBlocks) {
    for (const a of block.addons ?? []) {
      const m = migrateAddonItem(a);
      if (!addonById.has(m.id)) addonById.set(m.id, m);
    }
  }
  if (Array.isArray((p as Partial<MobileServicesState>).mobileAddons)) {
    for (const a of (p as Partial<MobileServicesState>).mobileAddons!) {
      const m = migrateAddonItem(a);
      if (!addonById.has(m.id)) addonById.set(m.id, m);
    }
  }
  const mobileAddons = [...addonById.values()];
  const vehicleCatalog = rawBlocks.map((block) => ({
    ...block,
    addons: [] as AddonItem[],
    services: (block.services ?? []).map((svc) => {
      const n = migrateServiceItem(svc);
      return { ...n, freeCoffeeCount: 0 };
    }),
  }));
  const promotions = Array.isArray(p.promotions) ? p.promotions : [];
  const dayTimePricing = Array.isArray(p.dayTimePricing) ? p.dayTimePricing : [];
  const loyaltyProgram = migrateLoyaltyProgramConfig(
    (p as Partial<MobileServicesState>).loyaltyProgram
  );

  const mobileOpsByPin: Record<string, MobileOpsForPin> = {};
  const rawOps = (p as Partial<MobileServicesState>).mobileOpsByPin;
  if (rawOps && typeof rawOps === 'object') {
    for (const [k, v] of Object.entries(rawOps)) {
      const pin = normalizePinCode(k);
      if (isValidPinCode(pin)) mobileOpsByPin[pin] = migrateMobileOpsBlock(v);
    }
  }

  return {
    managersByPin,
    staff,
    vehicleCatalog,
    mobileAddons,
    promotions,
    dayTimePricing,
    loyaltyProgram,
    mobileOpsByPin,
  };
}

export function loadMobileServicesState(): MobileServicesState {
  try {
    let storageSource = STORAGE_KEY;
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        const found = localStorage.getItem(key);
        if (found) {
          raw = found;
          storageSource = key;
          break;
        }
      }
    }
    if (!raw) {
      // Final fallback: check for legacy car_wash_services (logical group format)
      const legacyRaw = localStorage.getItem('car_wash_services');
      if (legacyRaw) {
        try {
          const list = JSON.parse(legacyRaw);
          const blocks: Record<string, ServiceItem[]> = {};
          for (const s of list) {
            const name = s.name || "";
            const cat = s.category || s.type || 'Washing';
            const dur = parseInt(s.baseDuration) || 60;
            const pts = s.description ? s.description.split('\n').map((l: string) => l.trim()).filter(Boolean) : [];
            const gid = s.catalogGroupId || s.id;
            const variants = s.fullVariants || [];
            for (const v of variants) {
              const vt = v.vehicle || 'Sedan';
              if (!blocks[vt]) blocks[vt] = [];
              blocks[vt].push({
                id: String(v.id || `sv_${Math.random().toString(36).slice(2)}`),
                name,
                price: parseFloat(v.price) || 0,
                catalogGroupId: String(gid),
                freeCoffeeCount: 0,
                eligibleForLoyaltyPoints: v.loyaltyCounted !== false,
                recommended: v.recommended === true,
                descriptionPoints: pts,
                active: v.active !== false,
                durationMinutes: dur,
                category: cat,
                sequence: 999,
                excludedPoints: [],
              });
            }
          }
          const vehicleCatalog = Object.entries(blocks).map(([vt, services]) => ({
            vehicleType: vt,
            services,
            addons: []
          }));
          const next = { ...emptyState(), vehicleCatalog };
          saveMobileServicesState(next);
          return next;
        } catch (e) {
          console.error("Failed to migrate legacy car_wash_services", e);
        }
      }
      return emptyState();
    }
    const p = JSON.parse(raw) as Partial<MobileServicesState> & { branches?: unknown[] };
    const next = migrateParsedShape(p);
    if (storageSource !== STORAGE_KEY) {
      saveMobileServicesState(next);
    }
    return next;
  } catch {
    return emptyState();
  }
}

export function saveMobileServicesState(state: MobileServicesState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const mobileServicesStoreApi = {
  generateStaffId: () => generateId('mss'),
  generateServiceId: () => generateId('sv'),
  generateAddonId: () => generateId('ad'),
  generatePromoId: () => generateId('pr'),
  generateDayPriceId: () => generateId('dt'),
  generateLoyaltyTierId: () => generateId('loy'),
  /** Must be a UUID — backend `/manager/mobile/bookings` rejects non-UUID `booking_id`. */
  generateMobileJobId: () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};
