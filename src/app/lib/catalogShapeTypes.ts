/**
 * Shared JSON shapes for service catalogs (vehicles, services, add-ons, promos, day/time rules).
 * Branch data and mobile data use the same field shapes but are stored in separate localStorage
 * backends — never mix runtime state between them.
 */

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  /**
   * Same id on rows that are vehicle variants of one logical service (service-centric admin).
   * Omitted or null for legacy rows (each treated as its own group).
   */
  catalogGroupId?: string | null;
  /**
   * Branch in-store only: how many complimentary coffees this service grants (0 = none).
   * Mobile services always store 0; the admin UI does not expose this for mobile.
   */
  freeCoffeeCount: number;
  /**
   * When true, this service's **price** is included in the loyalty spend total (last N services sum)
   * used to qualify for free-service slabs. Unchecked = price does not count. Any service may still
   * be chosen as a free reward on the Configure loyalty screen.
   */
  eligibleForLoyaltyPoints: boolean;
  /** Highlight service as recommended in USER UI lists. */
  recommended: boolean;
  /** Bullet points — what is included */
  descriptionPoints: string[];
  /** Bullet points — what is explicitly not included */
  excludedPoints: string[];
  /** When false, hidden from booking menus where applicable */
  active: boolean;
  /** Base wash time for slot math (minutes, multiple of 30). Add-ons add +30 each at booking time. */
  durationMinutes: number;
  /** 'Washing' or 'Detailing' */
  category: string;
  /**
   * User portal display order: lower appears first. Missing/invalid in stored JSON → 999.
   */
  sequence: number;
}

/** Default when `sequence` is absent (legacy data). */
export const SERVICE_DISPLAY_SEQUENCE_FALLBACK = 999;

/** Positive integer display sequence for services; invalid or missing → 999. */
export function coalesceServiceSequence(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const v = Math.floor(raw);
    if (v >= 1) return Math.min(v, 999999);
  }
  const p = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isNaN(p) && p >= 1) return Math.min(p, 999999);
  return SERVICE_DISPLAY_SEQUENCE_FALLBACK;
}

function newServiceId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function coalesceNonNegativeInt(n: unknown, fallback: number): number {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.max(0, Math.floor(n));
  const p = parseInt(String(n), 10);
  if (!Number.isNaN(p)) return Math.max(0, p);
  return fallback;
}

function snapServiceDurationMinutes(raw: unknown): number {
  let v =
    typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : parseInt(String(raw ?? 60), 10);
  if (!Number.isFinite(v) || v < 30) v = 60;
  const rem = v % 30;
  if (rem) v += 30 - rem;
  return Math.min(480, v);
}

/**
 * Normalize booleans from API JSON (snake_case / camelCase), localStorage, or DB drivers
 * that may return 0/1.
 */
function readBooleanField(
  x: Record<string, unknown>,
  camel: string,
  snake: string,
  defaultIfMissing: boolean
): boolean {
  const v = x[camel] ?? x[snake];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'true' || t === '1' || t === 'yes') return true;
    if (t === 'false' || t === '0' || t === 'no') return false;
  }
  return defaultIfMissing;
}

/** Normalize persisted or partial JSON into a `ServiceItem` (handles legacy `includesFreeCoffee`). */
export function migrateServiceItem(s: unknown): ServiceItem {
  const x = s as Record<string, unknown>;
  const pts = x.descriptionPoints ?? x.description_points;
  const exPts = x.excludedPoints ?? x.excluded_points;

  let freeCoffeeCount = 0;
  const rawFc = x.freeCoffeeCount ?? x.free_coffee_count;
  if (rawFc !== undefined && rawFc !== null) {
    freeCoffeeCount = coalesceNonNegativeInt(rawFc, 0);
  } else if (x.includesFreeCoffee === true) {
    freeCoffeeCount = 1;
  }

  /** API uses `eligible_for_loyalty_points`; local drafts may use camelCase. */
  const eligibleForLoyaltyPoints = readBooleanField(
    x,
    'eligibleForLoyaltyPoints',
    'eligible_for_loyalty_points',
    true
  );
  const recommended = readBooleanField(x, 'recommended', 'recommended', false);

  const rawGid = x.catalogGroupId ?? x.catalog_group_id;
  const catalogGroupId =
    typeof rawGid === 'string' && rawGid.trim() ? String(rawGid).trim() : null;

  const active = readBooleanField(x, 'active', 'active', true);

  return {
    id: String(x.id ?? newServiceId()),
    name: String(x.name ?? ''),
    price: typeof x.price === 'number' ? x.price : parseFloat(String(x.price)) || 0,
    ...(catalogGroupId ? { catalogGroupId } : {}),
    freeCoffeeCount,
    eligibleForLoyaltyPoints,
    recommended,
    descriptionPoints: Array.isArray(pts)
      ? pts.map(String)
      : typeof pts === 'string'
        ? pts.split('\n').map((l) => l.trim()).filter(Boolean)
        : [],
    excludedPoints: Array.isArray(exPts)
      ? exPts.map(String)
      : typeof exPts === 'string'
        ? exPts.split('\n').map((l) => l.trim()).filter(Boolean)
        : [],
    active,
    durationMinutes: snapServiceDurationMinutes(x.durationMinutes ?? x.duration_minutes),
    category: String(x.category ?? x.type ?? 'Washing'),
    sequence: coalesceServiceSequence(x.sequence ?? x.display_order ?? x.displayOrder),
  };
}

export interface AddonItem {
  id: string;
  name: string;
  price: number;
  descriptionPoints: string[];
  active: boolean;
}

export function migrateAddonItem(a: unknown): AddonItem {
  const x = a as Record<string, unknown>;
  const pts = x.descriptionPoints;
  return {
    id: String(x.id ?? `ad_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`),
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

export interface VehicleServiceBlock {
  vehicleType: string;
  services: ServiceItem[];
  addons: AddonItem[];
}

export interface PromoCode {
  id: string;
  codeName: string;
  discountType: 'percentage' | 'flat';
  /** Percentage (0–100) or flat amount in currency */
  discountValue: number;
  /** Validity start date (YYYY-MM-DD) */
  validityStart: string;
  /** Validity end date (YYYY-MM-DD) */
  validityEnd: string;
  maxUsesPerCustomer: number;
  applicableServiceIds: string[];
  applicableVehicleTypes: string[];
}

export interface DayTimePriceRule {
  id: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  applicableServiceIds: string[];
  applicableVehicleTypes: string[];
  /** e.g. Mon, Tue, … */
  applicableDays: string[];
  timeWindowStart: string;
  timeWindowEnd: string;
  validityStart: string;
  validityEnd: string;
}

/**
 * Spend slab: total in the qualifying window must be between min and max (inclusive).
 * `maxSpendInWindow: null` means no upper cap (legacy “at least min” behavior).
 */
export interface LoyaltySpendTier {
  id: string;
  /** Lower bound (inclusive) of total spend in the window */
  minSpendInWindow: number;
  /** Upper bound (inclusive); null = open-ended from min upward */
  maxSpendInWindow: number | null;
  /** Service granted free when spend falls in this slab — should be loyalty-eligible in catalog */
  rewardServiceId: string;
}

/**
 * Spend-based free service: sum prices of the customer's last N completed services;
 * a tier applies when that total is in [minSpendInWindow, maxSpendInWindow] (or ≥ min if max is null).
 */
export interface LoyaltyProgramConfig {
  /** How many most recent completed services count toward the spend sum (minimum 1) */
  qualifyingServiceCount: number;
  tiers: LoyaltySpendTier[];
}

export function emptyLoyaltyProgramConfig(): LoyaltyProgramConfig {
  return { qualifyingServiceCount: 10, tiers: [] };
}

function migrateLoyaltyTier(t: unknown): LoyaltySpendTier {
  const x = t as Record<string, unknown>;
  const minSpend =
    typeof x.minSpendInWindow === 'number'
      ? x.minSpendInWindow
      : parseFloat(String(x.minSpendInWindow ?? 0)) || 0;
  const minC = Math.max(0, minSpend);
  let maxSpend: number | null = null;
  if (x.maxSpendInWindow !== undefined && x.maxSpendInWindow !== null) {
    const raw =
      typeof x.maxSpendInWindow === 'number'
        ? x.maxSpendInWindow
        : parseFloat(String(x.maxSpendInWindow));
    if (!Number.isNaN(raw) && raw >= minC) {
      maxSpend = raw;
    } else if (!Number.isNaN(raw) && raw < minC) {
      maxSpend = minC;
    }
  }
  return {
    id: String(x.id ?? `loy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    minSpendInWindow: minC,
    maxSpendInWindow: maxSpend,
    rewardServiceId: String(x.rewardServiceId ?? ''),
  };
}

export function migrateLoyaltyProgramConfig(raw: unknown): LoyaltyProgramConfig {
  if (!raw || typeof raw !== 'object') return emptyLoyaltyProgramConfig();
  const o = raw as Record<string, unknown>;
  const qc = o.qualifyingServiceCount;
  let count =
    typeof qc === 'number' && Number.isFinite(qc) ? Math.floor(qc) : parseInt(String(qc ?? 10), 10);
  if (Number.isNaN(count) || count < 1) count = 10;
  const tiers = Array.isArray(o.tiers) ? o.tiers.map(migrateLoyaltyTier) : [];
  return { qualifyingServiceCount: count, tiers };
}

/** Whether total spend in the window falls in this slab (inclusive bounds). */
export function spendMatchesLoyaltySlab(totalSpend: number, tier: LoyaltySpendTier): boolean {
  if (totalSpend < tier.minSpendInWindow) return false;
  if (tier.maxSpendInWindow === null) return true;
  return totalSpend <= tier.maxSpendInWindow;
}

/** True if a completed line item for this service should add its price to the loyalty spend sum. */
export function servicePriceCountsTowardLoyalty(s: ServiceItem): boolean {
  return s.eligibleForLoyaltyPoints;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
