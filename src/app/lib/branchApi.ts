import type {
  AppState,
  Branch,
  BranchBookingJob,
  BranchData,
  BranchManager,
  DayTimePriceRule,
  FreeCoffeeRule,
  PromoCode,
  Washer,
} from './branchStore';
import type { AddonItem, LoyaltyProgramConfig, ServiceItem, VehicleServiceBlock } from './catalogShapeTypes';
import { coalesceServiceSequence, migrateServiceItem } from './catalogShapeTypes';
import { API_BASE } from './apiBase';
import { isBookingScheduleAndStaffLocked } from './managerPortalUtils';
const ADMIN_SESSION_KEY = 'carwash_admin_session_v1';
const MANAGER_SESSION_KEY = 'carwash_manager_session_v1';

type AuthContext =
  | { role: 'admin'; token: string }
  | { role: 'manager'; token: string; branchId: string };

function readAuth(): AuthContext | null {
  try {
    const rawAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (rawAdmin) {
      const a = JSON.parse(rawAdmin) as { accessToken?: string };
      if (a?.accessToken) return { role: 'admin', token: a.accessToken };
    }
  } catch {}
  try {
    const rawMgr = sessionStorage.getItem(MANAGER_SESSION_KEY);
    if (rawMgr) {
      const m = JSON.parse(rawMgr) as { accessToken?: string; branchId?: string };
      if (m?.accessToken && m?.branchId) return { role: 'manager', token: m.accessToken, branchId: m.branchId };
    }
  } catch {}
  return null;
}

type RequestOptions = { treatDeleteNotFoundAsOk?: boolean };

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  field?: string;

  constructor(message: string, status: number, code?: string, field?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  auth?: AuthContext | null,
  options?: RequestOptions
): Promise<T> {
  const token = auth?.token;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    const hint =
      err instanceof TypeError
        ? ' Network error — ensure the API is running (e.g. http://localhost:8000) and restart it after updates.'
        : '';
    throw new ApiRequestError(`Could not reach the server.${hint}`, 0, 'network_error');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (options?.treatDeleteNotFoundAsOk && init?.method === 'DELETE' && res.status === 404) {
      return undefined as T;
    }
    const detailPayload = typeof data?.detail === 'object' && data?.detail ? data.detail : {};
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof detailPayload?.detail === 'string'
          ? detailPayload.detail
          : `API ${res.status}`;
    const code = typeof detailPayload?.code === 'string' ? detailPayload.code : undefined;
    const field = typeof detailPayload?.field === 'string' ? detailPayload.field : undefined;
    throw new ApiRequestError(message, res.status, code, field);
  }
  return data as T;
}

/** Sync cleanup: DELETE may race or repeat; treat missing resource as success. */
async function deleteSyncResource(path: string, auth: AuthContext): Promise<void> {
  await request(path, { method: 'DELETE' }, auth, { treatDeleteNotFoundAsOk: true });
}

function createPerKeyAsyncQueue() {
  const queues = new Map<string, ReturnType<typeof createAsyncQueue>>();
  function createAsyncQueue() {
    let chain: Promise<void> = Promise.resolve();
    return async function enqueue<T>(fn: () => Promise<T>): Promise<T> {
      const result = chain.then(() => fn());
      chain = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    };
  }
  return function runSerialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let q = queues.get(key);
    if (!q) {
      q = createAsyncQueue();
      queues.set(key, q);
    }
    return q(fn);
  };
}

const runBranchSyncSerialized = createPerKeyAsyncQueue();

function mapBranch(raw: any): Branch {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    location: String(raw.location ?? ''),
    zipCode: String(raw.zip_code ?? raw.zipCode ?? ''),
    bayCount: Number(raw.bay_count ?? raw.bayCount ?? 1),
    openTime: String(raw.open_time ?? raw.openTime ?? '08:00'),
    closeTime: String(raw.close_time ?? raw.closeTime ?? '18:00'),
  };
}

function mapManager(raw: any): BranchManager {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    address: String(raw.address ?? ''),
    zipCode: String(raw.zip_code ?? raw.zipCode ?? ''),
    email: String(raw.email ?? ''),
    phone: String(raw.phone ?? ''),
    doj: String(raw.doj ?? ''),
    loginId: String(raw.login_id ?? raw.loginId ?? ''),
    password: '',
    active: raw.active !== false,
  };
}

function mapWasher(raw: any): Washer {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    address: String(raw.address ?? ''),
    zipCode: String(raw.zip_code ?? raw.zipCode ?? ''),
    email: String(raw.email ?? ''),
    phone: String(raw.phone ?? ''),
    doj: String(raw.doj ?? ''),
    loginId: String(raw.login_id ?? raw.loginId ?? ''),
    password: '',
    assignedBay: Number(raw.assigned_bay ?? raw.assignedBay ?? 1),
    active: raw.active !== false,
  };
}

function mapService(raw: any): ServiceItem {
  return migrateServiceItem(raw);
}

function mapAddon(raw: any): AddonItem {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    price: Number(raw.price ?? 0),
    descriptionPoints: Array.isArray(raw.description_points) ? raw.description_points.map(String) : [],
    active: raw.active !== false,
  };
}

function mapPromo(raw: any): PromoCode {
  return {
    id: String(raw.id ?? ''),
    codeName: String(raw.code_name ?? raw.codeName ?? ''),
    discountType: (raw.discount_type ?? raw.discountType) === 'percentage' ? 'percentage' : 'flat',
    discountValue: Number(raw.discount_value ?? raw.discountValue ?? 0),
    validityStart: String(raw.validity_start ?? raw.validityStart ?? ''),
    validityEnd: String(raw.validity_end ?? raw.validityEnd ?? ''),
    maxUsesPerCustomer: Number(raw.max_uses_per_customer ?? raw.maxUsesPerCustomer ?? 1),
    applicableServiceIds: Array.isArray(raw.applicable_service_ids) ? raw.applicable_service_ids.map(String) : [],
    applicableVehicleTypes: Array.isArray(raw.applicable_vehicle_types) ? raw.applicable_vehicle_types.map(String) : [],
  };
}

function mapDayRule(raw: any): DayTimePriceRule {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    discountType: (raw.discount_type ?? raw.discountType) === 'percentage' ? 'percentage' : 'flat',
    discountValue: Number(raw.discount_value ?? raw.discountValue ?? 0),
    applicableServiceIds: Array.isArray(raw.applicable_service_ids) ? raw.applicable_service_ids.map(String) : [],
    applicableVehicleTypes: Array.isArray(raw.applicable_vehicle_types) ? raw.applicable_vehicle_types.map(String) : [],
    applicableDays: Array.isArray(raw.applicable_days) ? raw.applicable_days.map(String) : [],
    timeWindowStart: String(raw.time_window_start ?? ''),
    timeWindowEnd: String(raw.time_window_end ?? ''),
    validityStart: String(raw.validity_start ?? ''),
    validityEnd: String(raw.validity_end ?? ''),
  };
}

function mapFreeCoffee(raw: any): FreeCoffeeRule {
  return {
    id: String(raw.id ?? ''),
    kind: raw.kind === 'after_n_services' ? 'after_n_services' : 'on_service',
    serviceName: raw.service_name ?? undefined,
    servicesCount: raw.services_count ?? undefined,
    notes: String(raw.notes ?? ''),
  };
}

function mapBooking(raw: any): BranchBookingJob {
  const rawStatus = String(raw.status ?? 'scheduled');
  const status =
    rawStatus === 'assigned' ||
    rawStatus === 'arrived' ||
    rawStatus === 'checked_in' ||
    rawStatus === 'in_progress' ||
    rawStatus === 'completed' ||
    rawStatus === 'cancelled' ||
    rawStatus === 'scheduled'
      ? rawStatus
      : rawStatus === 'booked'
        ? 'scheduled'
        : 'scheduled';
  return {
    id: String(raw.id ?? ''),
    customerName: String(raw.customer_name ?? ''),
    address: String(raw.address ?? ''),
    phone: String(raw.phone ?? ''),
    vehicleType: String(raw.vehicle_type ?? ''),
    vehicleName: String(raw.vehicle_model ?? ''),
    registrationNumber: String(raw.registration_number ?? ''),
    serviceSummary: String(raw.service_summary ?? ''),
    serviceId: raw.service_id == null || raw.service_id === '' ? null : String(raw.service_id),
    selectedAddonIds: Array.isArray(raw.selected_addon_ids)
      ? raw.selected_addon_ids.map(String)
      : Array.isArray(raw.selectedAddonIds)
        ? raw.selectedAddonIds.map(String)
        : [],
    slotDate: String(raw.slot_date ?? ''),
    startTime: String(raw.start_time ?? ''),
    endTime: String(raw.end_time ?? ''),
    bayNumber: raw.bay_number == null ? null : Number(raw.bay_number),
    assignedWasherId: raw.assigned_washer_id ?? null,
    status,
    source: raw.source ?? 'walk_in',
    notes: String(raw.notes ?? ''),
    managerNotes: String(raw.manager_notes ?? ''),
    customerId: raw.customer_id ?? null,
    email: String(raw.customer_email ?? raw.email ?? ''),
    tipCents: Number(raw.tip_cents ?? raw.tipCents ?? 0) || 0,
    paymentMethod: raw.payment_method ? String(raw.payment_method) : undefined,
    createdAt: String(raw.created_at ?? new Date().toISOString()),
  };
}

function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

export function buildBookingPatchPayload(
  prev: BranchBookingJob | undefined,
  next: BranchBookingJob
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const setIfChanged = <K extends keyof BranchBookingJob>(key: K, apiKey?: string) => {
    if (!prev || prev[key] !== next[key]) {
      const val = next[key] as unknown;
      if (key === 'assignedWasherId' && (val === null || val === undefined || val === '')) {
        patch.assigned_washer_id = null;
      } else {
        patch[apiKey ?? String(key)] = val;
      }
    }
  };

  // Always send status so the backend reflects the manager's intent even when
  // only slot fields (date/time) change in the same save.
  patch.status =
    next.assignedWasherId && next.status === 'scheduled' ? 'assigned' : next.status;
  setIfChanged('assignedWasherId', 'assigned_washer_id');
  setIfChanged('bayNumber', 'bay_number');
  setIfChanged('notes');
  if (!prev || prev.managerNotes !== next.managerNotes) patch.manager_notes = next.managerNotes ?? '';

  // Do not send slot/date fields unless they actually changed: backend validates
  // re-scheduling targets and rejects past dates/times.
  if (!prev || prev.slotDate !== next.slotDate) patch.slot_date = next.slotDate;
  if (!prev || prev.startTime !== next.startTime) patch.start_time = next.startTime;
  if (!prev || prev.endTime !== next.endTime) patch.end_time = next.endTime;

  if (!prev || prev.customerName !== next.customerName) patch.customer_name = next.customerName;
  if (!prev || prev.phone !== next.phone) patch.phone = next.phone;
  if (!prev || prev.address !== next.address) patch.address = next.address;
  if (!prev || prev.vehicleType !== next.vehicleType) patch.vehicle_type = next.vehicleType;
  if (!prev || prev.vehicleName !== next.vehicleName) patch.vehicle_model = next.vehicleName ?? '';
  if (!prev || prev.registrationNumber !== next.registrationNumber) patch.registration_number = next.registrationNumber ?? '';
  if (!prev || prev.serviceSummary !== next.serviceSummary) patch.service_summary = next.serviceSummary;
  if (!prev || prev.serviceId !== next.serviceId) patch.service_id = next.serviceId ?? null;
  if (!arraysEqual(prev?.selectedAddonIds, next.selectedAddonIds)) {
    patch.selected_addon_ids = next.selectedAddonIds ?? [];
  }
  if (!prev || prev.tipCents !== next.tipCents) patch.tip_cents = next.tipCents ?? 0;

  if (prev && isBookingScheduleAndStaffLocked(prev.status)) {
    delete patch.slot_date;
    delete patch.start_time;
    delete patch.end_time;
    delete patch.bay_number;
    delete patch.assigned_washer_id;
  }

  return patch;
}

export function buildBranchBookingStatusPatch(
  job: BranchBookingJob,
  nextStatus: BranchBookingJob['status']
): Record<string, unknown> {
  const status =
    job.assignedWasherId && nextStatus === 'scheduled' ? 'assigned' : nextStatus;
  const patch: Record<string, unknown> = { status };
  if (job.assignedWasherId) patch.assigned_washer_id = job.assignedWasherId;
  return patch;
}

export function branchBookingJobToCreateBody(job: BranchBookingJob): Record<string, unknown> {
  return {
    booking_id: job.id,
    customer_name: job.customerName,
    phone: job.phone,
    customer_email: job.email ?? '',
    address: job.address,
    vehicle_type: job.vehicleType,
    vehicle_model: job.vehicleName ?? '',
    registration_number: job.registrationNumber ?? '',
    service_summary: job.serviceSummary,
    ...(job.serviceId ? { service_id: job.serviceId } : {}),
    selected_addon_ids: job.selectedAddonIds ?? [],
    slot_date: job.slotDate,
    start_time: job.startTime,
    end_time: job.endTime,
    notes: job.notes ?? '',
    manager_notes: job.managerNotes ?? '',
    bay_number: job.bayNumber ?? undefined,
    assigned_washer_id: job.assignedWasherId ?? undefined,
    source: job.source ?? 'walk_in',
    customer_id: job.customerId ?? null,
    tip_cents: job.tipCents ?? 0,
    ...(job.serviceChargedCents != null
      ? { service_charged_cents: Math.max(0, Math.floor(job.serviceChargedCents)) }
      : {}),
    payment_method: (() => {
      const pm = job.paymentMethod;
      if (!pm) return 'cash';
      if (pm === 'pay_after') return 'later';
      if (pm === 'apple_pay') return 'apple';
      return pm; // 'card' and any future values pass through as-is
    })(),
  };
}

/** Create a walk-in booking and return the persisted record from the API. */
export async function createBranchManagerBooking(job: BranchBookingJob): Promise<BranchBookingJob> {
  const auth = readAuth();
  if (!auth || auth.role !== 'manager') throw new Error('Authentication required');
  const raw = await request<Record<string, unknown>>(
    '/manager/bookings',
    { method: 'POST', body: JSON.stringify(branchBookingJobToCreateBody(job)) },
    auth
  );
  return mapBooking(raw);
}

/** Persist a single branch booking update without bulk state sync. */
export async function patchBranchManagerBooking(
  bookingId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'manager') throw new Error('Authentication required');
  if (Object.keys(payload).length === 0) return;
  await request(
    `/manager/bookings/${bookingId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    auth
  );
}

export type BranchSyncOptions = { syncBookings?: boolean };

async function loadBranchDataAdmin(auth: AuthContext & { role: 'admin' }, branchId: string): Promise<BranchData> {
  const [managers, washers, blocks, addons, promos, dayRules, freeCoffee, loyalty, slot, bookings] = await Promise.all([
    request<any[]>(`/admin/branches/${branchId}/managers`, undefined, auth),
    request<any[]>(`/admin/branches/${branchId}/washers`, undefined, auth),
    request<any[]>(`/admin/branches/${branchId}/vehicle-blocks`, undefined, auth),
    request<any[]>(`/admin/branches/${branchId}/addons`, undefined, auth),
    request<any[]>(`/admin/branches/${branchId}/promotions`, undefined, auth),
    request<any[]>(`/admin/branches/${branchId}/day-time-rules`, undefined, auth),
    request<any[]>(`/admin/branches/${branchId}/free-coffee-rules`, undefined, auth),
    request<any>(`/admin/branches/${branchId}/loyalty`, undefined, auth),
    request<any>(`/admin/branches/${branchId}/slot-settings`, undefined, auth),
    request<any[]>(`/admin/branches/${branchId}/bookings`, undefined, auth),
  ]);
  const vehicleServices: VehicleServiceBlock[] = (blocks ?? []).map((b: any) => ({
    vehicleType: String(b.vehicle_type ?? ''),
    services: Array.isArray(b.services) ? b.services.map(mapService) : [],
    addons: Array.isArray(b.addons) ? b.addons.map(mapAddon) : [],
  }));
  const loyaltyProgram: LoyaltyProgramConfig = {
    qualifyingServiceCount: Number(loyalty?.qualifying_service_count ?? 10),
    tiers: Array.isArray(loyalty?.tiers)
      ? loyalty.tiers.map((t: any) => ({
          id: String(t.id ?? ''),
          minSpendInWindow: Number(t.minSpendInWindow ?? 0),
          maxSpendInWindow: t.maxSpendInWindow == null ? null : Number(t.maxSpendInWindow),
          rewardServiceId: String(t.rewardServiceId ?? ''),
        }))
      : [],
  };
  return {
    branchManagers: managers.map(mapManager),
    washers: washers.map(mapWasher),
    vehicleServices,
    branchAddons: addons.map(mapAddon),
    promotions: promos.map(mapPromo),
    dayTimePricing: dayRules.map(mapDayRule),
    freeCoffeeRules: freeCoffee.map(mapFreeCoffee),
    loyaltyProgram,
    managerSlotDurationMinutes: Number(slot?.manager_slot_duration_minutes ?? 60),
    slotBayOpenByWindow: slot?.slot_bay_open_by_window ?? undefined,
    slotWindowActiveByKey: slot?.slot_window_active_by_key ?? undefined,
    slotDayStates: slot?.slot_day_states ?? undefined,
    branchBookings: bookings.map(mapBooking),
  };
}

async function loadBranchDataManager(auth: AuthContext & { role: 'manager' }, branch: Branch): Promise<BranchData> {
  const [snapshot, washers, bookings, slot] = await Promise.all([
    request<any>(`/public/branches/${branch.id}/snapshot`, undefined, null),
    request<any[]>(`/manager/washers`, undefined, auth),
    request<any[]>(`/manager/bookings`, undefined, auth),
    request<any>(`/manager/slot-settings`, undefined, auth),
  ]);
  return {
    branchManagers: [],
    washers: washers.map(mapWasher),
    vehicleServices: Array.isArray(snapshot?.vehicle_blocks)
      ? snapshot.vehicle_blocks.map((b: any) => ({
          vehicleType: String(b.vehicle_type ?? ''),
          services: Array.isArray(b.services) ? b.services.map(mapService) : [],
          addons: Array.isArray(b.addons) ? b.addons.map(mapAddon) : [],
        }))
      : [],
    branchAddons: Array.isArray(snapshot?.branch_addons) ? snapshot.branch_addons.map(mapAddon) : [],
    promotions: Array.isArray(snapshot?.promotions) ? snapshot.promotions.map(mapPromo) : [],
    dayTimePricing: Array.isArray(snapshot?.day_time_rules) ? snapshot.day_time_rules.map(mapDayRule) : [],
    freeCoffeeRules: Array.isArray(snapshot?.free_coffee_rules) ? snapshot.free_coffee_rules.map(mapFreeCoffee) : [],
    loyaltyProgram: {
      qualifyingServiceCount: Number(snapshot?.loyalty?.qualifying_service_count ?? 10),
      tiers: Array.isArray(snapshot?.loyalty?.tiers)
        ? snapshot.loyalty.tiers.map((t: any) => ({
            id: String(t.id ?? ''),
            minSpendInWindow: Number(t.minSpendInWindow ?? 0),
            maxSpendInWindow: t.maxSpendInWindow == null ? null : Number(t.maxSpendInWindow),
            rewardServiceId: String(t.rewardServiceId ?? ''),
          }))
        : [],
    },
    managerSlotDurationMinutes: Number(slot?.manager_slot_duration_minutes ?? 60),
    slotBayOpenByWindow: slot?.slot_bay_open_by_window ?? undefined,
    slotWindowActiveByKey: slot?.slot_window_active_by_key ?? undefined,
    slotDayStates: slot?.slot_day_states ?? undefined,
    branchBookings: bookings.map(mapBooking),
  };
}

export async function fetchAppStateFromApi(): Promise<AppState> {
  const auth = readAuth();
  if (!auth) return { branches: [], dataByBranchId: {} };
  if (auth.role === 'admin') {
    const rawBranches = await request<any[]>('/admin/branches', undefined, auth);
    const branches = rawBranches.map(mapBranch);
    const entries = await Promise.all(
      branches.map(async (b) => [b.id, await loadBranchDataAdmin(auth, b.id)] as const)
    );
    return { branches, dataByBranchId: Object.fromEntries(entries) };
  }
  const branchRaw = await request<any>(`/public/branches/${auth.branchId}`, undefined, null);
  const branch = mapBranch(branchRaw);
  return {
    branches: [branch],
    dataByBranchId: { [branch.id]: await loadBranchDataManager(auth, branch) },
  };
}

export async function upsertBranchToApi(branch: Branch): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  if (branch.id) {
    await request(
      `/admin/branches/${branch.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: branch.name,
          location: branch.location,
          zip_code: branch.zipCode,
          bay_count: branch.bayCount,
          open_time: branch.openTime,
          close_time: branch.closeTime,
        }),
      },
      auth
    );
  } else {
    await request(
      '/admin/branches',
      {
        method: 'POST',
        body: JSON.stringify({
          name: branch.name,
          location: branch.location,
          zip_code: branch.zipCode,
          bay_count: branch.bayCount,
          open_time: branch.openTime,
          close_time: branch.closeTime,
        }),
      },
      auth
    );
  }
}

export async function deleteBranchFromApi(branchId: string): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/branches/${branchId}`, { method: 'DELETE' }, auth);
}

export async function deleteBranchManagerFromApi(branchId: string, managerId: string): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/branches/${branchId}/managers/${managerId}`, { method: 'DELETE' }, auth);
}

export async function deleteBranchWasherFromApi(branchId: string, washerId: string): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/branches/${branchId}/washers/${washerId}`, { method: 'DELETE' }, auth);
}

export async function deleteBranchAddonFromApi(branchId: string, addonId: string): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/branches/${branchId}/addons/${addonId}`, { method: 'DELETE' }, auth);
}

export async function deleteBranchPromotionFromApi(branchId: string, promoId: string): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/branches/${branchId}/promotions/${promoId}`, { method: 'DELETE' }, auth);
}

export async function deleteBranchDayRuleFromApi(branchId: string, ruleId: string): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/branches/${branchId}/day-time-rules/${ruleId}`, { method: 'DELETE' }, auth);
}

export async function saveBranchPromotionToApi(branchId: string, promo: PromoCode): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  const body = {
    id: promo.id,
    code_name: promo.codeName,
    discount_type: promo.discountType,
    discount_value: promo.discountValue,
    validity_start: promo.validityStart,
    validity_end: promo.validityEnd,
    max_uses_per_customer: promo.maxUsesPerCustomer,
    applicable_service_ids: promo.applicableServiceIds ?? [],
    applicable_vehicle_types: promo.applicableVehicleTypes ?? [],
  };
  const existing = await request<any[]>(`/admin/branches/${branchId}/promotions`, undefined, auth);
  const exists = existing.some((x) => String(x.id) === promo.id);
  if (exists) {
    await request(`/admin/branches/${branchId}/promotions/${promo.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    return;
  }
  await request(`/admin/branches/${branchId}/promotions`, { method: 'POST', body: JSON.stringify(body) }, auth);
}

export async function saveBranchAddonToApi(branchId: string, addon: AddonItem): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  const body = {
    id: addon.id,
    name: addon.name,
    price: addon.price,
    description_points: addon.descriptionPoints ?? [],
    active: addon.active !== false,
  };
  const existing = await request<any[]>(`/admin/branches/${branchId}/addons`, undefined, auth);
  const exists = existing.some((x) => String(x.id) === addon.id);
  if (exists) {
    await request(`/admin/branches/${branchId}/addons/${addon.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    return;
  }
  await request(`/admin/branches/${branchId}/addons`, { method: 'POST', body: JSON.stringify(body) }, auth);
}

export async function saveBranchDayRuleToApi(branchId: string, rule: DayTimePriceRule): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  const body = {
    id: rule.id,
    title: rule.title,
    description: rule.description,
    discount_type: rule.discountType,
    discount_value: rule.discountValue,
    applicable_service_ids: rule.applicableServiceIds ?? [],
    applicable_vehicle_types: rule.applicableVehicleTypes ?? [],
    applicable_days: rule.applicableDays ?? [],
    time_window_start: rule.timeWindowStart,
    time_window_end: rule.timeWindowEnd,
    validity_start: rule.validityStart,
    validity_end: rule.validityEnd,
  };
  const existing = await request<any[]>(`/admin/branches/${branchId}/day-time-rules`, undefined, auth);
  const exists = existing.some((x) => String(x.id) === rule.id);
  if (exists) {
    await request(`/admin/branches/${branchId}/day-time-rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    return;
  }
  await request(`/admin/branches/${branchId}/day-time-rules`, { method: 'POST', body: JSON.stringify(body) }, auth);
}

export async function saveManagerToApi(
  branchId: string,
  payload: {
    id?: string | null;
    name: string;
    address: string;
    zipCode: string;
    email: string;
    phone: string;
    doj: string;
    loginId: string;
    password?: string;
    active: boolean;
  }
): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  const body = {
    name: payload.name,
    address: payload.address,
    zip_code: payload.zipCode,
    email: payload.email,
    phone: payload.phone,
    doj: payload.doj,
    login_id: payload.loginId,
    ...(payload.password ? { password: payload.password } : {}),
    active: payload.active,
  };
  if (payload.id) {
    await request(`/admin/branches/${branchId}/managers/${payload.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    return;
  }
  await request(`/admin/branches/${branchId}/managers`, { method: 'POST', body: JSON.stringify(body) }, auth);
}

export async function saveWasherToApi(
  branchId: string,
  payload: {
    id?: string | null;
    name: string;
    address: string;
    zipCode: string;
    email: string;
    phone: string;
    doj: string;
    loginId: string;
    password?: string;
    assignedBay: number;
    active: boolean;
  }
): Promise<void> {
  const auth = readAuth();
  if (!auth || auth.role !== 'admin') throw new Error('Admin authentication required');
  const body = {
    name: payload.name,
    address: payload.address,
    zip_code: payload.zipCode,
    email: payload.email,
    phone: payload.phone,
    doj: payload.doj,
    login_id: payload.loginId,
    ...(payload.password ? { password: payload.password } : {}),
    assigned_bay: payload.assignedBay,
    active: payload.active,
  };
  if (payload.id) {
    await request(`/admin/branches/${branchId}/washers/${payload.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    return;
  }
  await request(`/admin/branches/${branchId}/washers`, { method: 'POST', body: JSON.stringify(body) }, auth);
}

async function syncManagers(branchId: string, next: BranchManager[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/managers`, undefined, auth);
  const existingIds = new Set(existing.map((m) => String(m.id)));
  const nextIds = new Set(next.map((m) => m.id));
  for (const m of next) {
    const body = {
      name: m.name,
      address: m.address,
      zip_code: m.zipCode,
      email: m.email,
      phone: m.phone,
      doj: m.doj,
      login_id: m.loginId,
      password: m.password || 'ChangeMe@123',
      active: m.active,
    };
    if (m.id && existingIds.has(m.id)) {
      await request(`/admin/branches/${branchId}/managers/${m.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    } else {
      await request(`/admin/branches/${branchId}/managers`, { method: 'POST', body: JSON.stringify(body) }, auth);
    }
  }
  for (const m of existing) {
    const id = String(m.id);
    if (!nextIds.has(id)) await deleteSyncResource(`/admin/branches/${branchId}/managers/${id}`, auth);
  }
}

async function syncWashers(branchId: string, next: Washer[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/washers`, undefined, auth);
  const existingIds = new Set(existing.map((m) => String(m.id)));
  const nextIds = new Set(next.map((m) => m.id));
  for (const w of next) {
    const body = {
      name: w.name,
      address: w.address,
      zip_code: w.zipCode,
      email: w.email,
      phone: w.phone,
      doj: w.doj,
      login_id: w.loginId,
      password: w.password || 'ChangeMe@123',
      assigned_bay: w.assignedBay,
      active: w.active,
    };
    if (w.id && existingIds.has(w.id)) {
      await request(`/admin/branches/${branchId}/washers/${w.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    } else {
      await request(`/admin/branches/${branchId}/washers`, { method: 'POST', body: JSON.stringify(body) }, auth);
    }
  }
  for (const w of existing) {
    const id = String(w.id);
    if (!nextIds.has(id)) await deleteSyncResource(`/admin/branches/${branchId}/washers/${id}`, auth);
  }
}

async function syncVehicleBlocks(branchId: string, next: VehicleServiceBlock[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/vehicle-blocks`, undefined, auth);
  const existingIds = new Set(existing.map((x) => String(x.id)));
  const existingServiceIdsByVehicle = new Map<string, Set<string>>();
  for (const block of existing) {
    const vehicleKey = String(block.vehicle_type ?? '').toLowerCase();
    const serviceIds = new Set<string>();
    if (Array.isArray(block.services)) {
      for (const svc of block.services) {
        const id = String(svc?.id ?? '').trim();
        if (id) serviceIds.add(id);
      }
    }
    existingServiceIdsByVehicle.set(vehicleKey, serviceIds);
  }
  const nextIds = new Set<string>();
  for (const b of next) {
    const vehicleKey = b.vehicleType.toLowerCase();
    const knownServiceIds = existingServiceIdsByVehicle.get(vehicleKey) ?? new Set<string>();
    const body = {
      vehicle_type: b.vehicleType,
      services: (b.services ?? []).map((s) => ({
        ...(knownServiceIds.has(String(s.id)) ? { id: s.id } : {}),
        name: s.name,
        price: s.price,
        free_coffee_count: Math.max(0, Math.floor(Number(s.freeCoffeeCount ?? 0))),
        eligible_for_loyalty_points: s.eligibleForLoyaltyPoints,
        recommended: s.recommended,
        description_points: s.descriptionPoints ?? [],
        excluded_points: s.excludedPoints ?? [],
        active: s.active,
        catalog_group_id: s.catalogGroupId ?? null,
        duration_minutes: s.durationMinutes ?? 60,
        category: s.category?.trim() || 'Washing',
        sequence: coalesceServiceSequence(s.sequence),
      })),
      addons: [],
    };
    const existingByVehicle = existing.find((x) => String(x.vehicle_type ?? '') === b.vehicleType);
    if (existingByVehicle?.id) {
      const id = String(existingByVehicle.id);
      nextIds.add(id);
      await request(`/admin/branches/${branchId}/vehicle-blocks/${id}`, { method: 'PUT', body: JSON.stringify(body) }, auth);
    } else {
      const created = await request<any>(`/admin/branches/${branchId}/vehicle-blocks`, { method: 'POST', body: JSON.stringify(body) }, auth);
      if (created?.id) nextIds.add(String(created.id));
    }
  }
  for (const x of existing) {
    const id = String(x.id);
    if (!nextIds.has(id)) await deleteSyncResource(`/admin/branches/${branchId}/vehicle-blocks/${id}`, auth);
  }
}

async function syncBranchAddons(branchId: string, next: AddonItem[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/addons`, undefined, auth);
  const existingIds = new Set(existing.map((x) => String(x.id)));
  const nextIds = new Set(next.map((x) => x.id));
  for (const a of next) {
    const body = {
      id: a.id,
      name: a.name,
      price: a.price,
      description_points: a.descriptionPoints ?? [],
      active: a.active !== false,
    };
    if (a.id && existingIds.has(a.id)) {
      await request(`/admin/branches/${branchId}/addons/${a.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    } else {
      await request(`/admin/branches/${branchId}/addons`, { method: 'POST', body: JSON.stringify(body) }, auth);
    }
  }
  for (const x of existing) {
    const id = String(x.id);
    if (!nextIds.has(id)) await deleteSyncResource(`/admin/branches/${branchId}/addons/${id}`, auth);
  }
}

async function syncPromoList(branchId: string, next: PromoCode[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/promotions`, undefined, auth);
  const existingIds = new Set(existing.map((x) => String(x.id)));
  const nextIds = new Set(next.map((x) => x.id));
  for (const p of next) {
    const body = {
      id: p.id,
      code_name: p.codeName,
      discount_type: p.discountType,
      discount_value: p.discountValue,
      validity_start: p.validityStart,
      validity_end: p.validityEnd,
      max_uses_per_customer: p.maxUsesPerCustomer,
      applicable_service_ids: p.applicableServiceIds ?? [],
      applicable_vehicle_types: p.applicableVehicleTypes ?? [],
    };
    if (p.id && existingIds.has(p.id)) await request(`/admin/branches/${branchId}/promotions/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    else await request(`/admin/branches/${branchId}/promotions`, { method: 'POST', body: JSON.stringify(body) }, auth);
  }
  for (const x of existing) {
    const id = String(x.id);
    if (!nextIds.has(id)) await deleteSyncResource(`/admin/branches/${branchId}/promotions/${id}`, auth);
  }
}

async function syncDayRules(branchId: string, next: DayTimePriceRule[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/day-time-rules`, undefined, auth);
  const existingIds = new Set(existing.map((x) => String(x.id)));
  const nextIds = new Set(next.map((x) => x.id));
  for (const r of next) {
    const body = {
      id: r.id,
      title: r.title,
      description: r.description,
      discount_type: r.discountType,
      discount_value: r.discountValue,
      applicable_service_ids: r.applicableServiceIds ?? [],
      applicable_vehicle_types: r.applicableVehicleTypes ?? [],
      applicable_days: r.applicableDays ?? [],
      time_window_start: r.timeWindowStart,
      time_window_end: r.timeWindowEnd,
      validity_start: r.validityStart,
      validity_end: r.validityEnd,
    };
    if (r.id && existingIds.has(r.id)) await request(`/admin/branches/${branchId}/day-time-rules/${r.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    else await request(`/admin/branches/${branchId}/day-time-rules`, { method: 'POST', body: JSON.stringify(body) }, auth);
  }
  for (const x of existing) {
    const id = String(x.id);
    if (!nextIds.has(id)) await deleteSyncResource(`/admin/branches/${branchId}/day-time-rules/${id}`, auth);
  }
}

async function syncCoffeeRules(branchId: string, next: FreeCoffeeRule[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/free-coffee-rules`, undefined, auth);
  const existingIds = new Set(existing.map((x) => String(x.id)));
  const nextIds = new Set(next.map((x) => x.id));
  for (const r of next) {
    const body = {
      id: r.id,
      kind: r.kind,
      service_name: r.serviceName ?? null,
      services_count: r.servicesCount ?? null,
      notes: r.notes,
    };
    if (r.id && existingIds.has(r.id)) await request(`/admin/branches/${branchId}/free-coffee-rules/${r.id}`, { method: 'PATCH', body: JSON.stringify(body) }, auth);
    else await request(`/admin/branches/${branchId}/free-coffee-rules`, { method: 'POST', body: JSON.stringify(body) }, auth);
  }
  for (const x of existing) {
    const id = String(x.id);
    if (!nextIds.has(id)) await deleteSyncResource(`/admin/branches/${branchId}/free-coffee-rules/${id}`, auth);
  }
}

async function syncLoyalty(branchId: string, loyalty: LoyaltyProgramConfig, auth: AuthContext & { role: 'admin' }) {
  await request(
    `/admin/branches/${branchId}/loyalty`,
    {
      method: 'PUT',
      body: JSON.stringify({
        qualifying_service_count: loyalty.qualifyingServiceCount,
        tiers: (loyalty.tiers ?? []).map((t) => ({
          id: t.id,
          min_spend_in_window: t.minSpendInWindow,
          max_spend_in_window: t.maxSpendInWindow,
          reward_service_id: t.rewardServiceId,
        })),
      }),
    },
    auth
  );
}

async function syncSlotSettingsAdmin(branchId: string, data: BranchData, auth: AuthContext & { role: 'admin' }) {
  await request(
    `/admin/branches/${branchId}/slot-settings`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        manager_slot_duration_minutes: data.managerSlotDurationMinutes,
        slot_bay_open_by_window: data.slotBayOpenByWindow ?? {},
        slot_window_active_by_key: data.slotWindowActiveByKey ?? {},
        slot_day_states: data.slotDayStates ?? {},
      }),
    },
    auth
  );
}

async function syncBookingsAdmin(branchId: string, next: BranchBookingJob[], auth: AuthContext & { role: 'admin' }) {
  const existing = await request<any[]>(`/admin/branches/${branchId}/bookings`, undefined, auth);
  const existingIds = new Set(existing.map((x) => String(x.id)));
  for (const b of next) {
    const prevB = existing.find((x) => String(x.id) === b.id);
    if (b.id && existingIds.has(b.id)) {
      const patchPayload = buildBookingPatchPayload(prevB ? mapBooking(prevB) : undefined, b);
      if (Object.keys(patchPayload).length === 0) continue;
      await request(
        `/admin/branches/${branchId}/bookings/${b.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patchPayload),
        },
        auth
      );
    } else {
      await request(
        `/admin/branches/${branchId}/bookings`,
        {
          method: 'POST',
          body: JSON.stringify({
            customer_name: b.customerName,
            phone: b.phone,
            customer_email: b.email ?? '',
            address: b.address,
            vehicle_type: b.vehicleType,
            service_summary: b.serviceSummary,
            ...(b.serviceId ? { service_id: b.serviceId } : {}),
            selected_addon_ids: b.selectedAddonIds ?? [],
            slot_date: b.slotDate,
            start_time: b.startTime,
            end_time: b.endTime,
            source: b.source,
            customer_id: b.customerId ?? null,
            tip_cents: b.tipCents ?? 0,
            ...(b.serviceChargedCents != null
              ? { service_charged_cents: Math.max(0, Math.floor(b.serviceChargedCents)) }
              : {}),
          }),
        },
        auth
      );
    }
  }
}

async function syncManagerState(
  prev: BranchData,
  next: BranchData,
  auth: AuthContext & { role: 'manager' },
  options?: BranchSyncOptions
) {
  const prevSlot = {
    manager_slot_duration_minutes: prev.managerSlotDurationMinutes,
    slot_bay_open_by_window: prev.slotBayOpenByWindow ?? {},
    slot_window_active_by_key: prev.slotWindowActiveByKey ?? {},
    slot_day_states: prev.slotDayStates ?? {},
  };
  const nextSlot = {
    manager_slot_duration_minutes: next.managerSlotDurationMinutes,
    slot_bay_open_by_window: next.slotBayOpenByWindow ?? {},
    slot_window_active_by_key: next.slotWindowActiveByKey ?? {},
    slot_day_states: next.slotDayStates ?? {},
  };
  if (JSON.stringify(prevSlot) !== JSON.stringify(nextSlot)) {
    await request(
      '/manager/slot-settings',
      { method: 'PATCH', body: JSON.stringify(nextSlot) },
      auth
    );
  }

  if (options?.syncBookings === false) return;
  if (JSON.stringify(prev.branchBookings) === JSON.stringify(next.branchBookings)) return;

  const existing = await request<any[]>('/manager/bookings', undefined, auth);
  const existingIds = new Set(existing.map((x) => String(x.id)));
  const prevById = new Map(prev.branchBookings.map((b) => [b.id, b]));

  for (const b of next.branchBookings) {
    if (b.id && existingIds.has(b.id)) {
      // Only PATCH if this booking actually changed from prev state.
      const prevB = prevById.get(b.id);
      const patchPayload = buildBookingPatchPayload(prevB, b);
      if (Object.keys(patchPayload).length === 0) continue;
      await request(
        `/manager/bookings/${b.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patchPayload),
        },
        auth
      );
    } else {
      await request(
        '/manager/bookings',
        { method: 'POST', body: JSON.stringify(branchBookingJobToCreateBody(b)) },
        auth
      );
    }
  }
}

async function syncBranchDataToApiBody(
  branchId: string,
  prev: BranchData,
  next: BranchData,
  options?: BranchSyncOptions
): Promise<void> {
  const auth = readAuth();
  if (!auth) throw new Error('Authentication required');
  if (auth.role === 'manager') {
    await syncManagerState(prev, next, auth, options);
    return;
  }
  if (JSON.stringify(prev.branchManagers) !== JSON.stringify(next.branchManagers)) {
    await syncManagers(branchId, next.branchManagers, auth);
  }
  if (JSON.stringify(prev.washers) !== JSON.stringify(next.washers)) {
    await syncWashers(branchId, next.washers, auth);
  }
  if (JSON.stringify(prev.vehicleServices) !== JSON.stringify(next.vehicleServices)) {
    await syncVehicleBlocks(branchId, next.vehicleServices, auth);
  }
  if (JSON.stringify(prev.branchAddons) !== JSON.stringify(next.branchAddons)) {
    await syncBranchAddons(branchId, next.branchAddons, auth);
  }
  if (JSON.stringify(prev.promotions) !== JSON.stringify(next.promotions)) {
    await syncPromoList(branchId, next.promotions, auth);
  }
  if (JSON.stringify(prev.dayTimePricing) !== JSON.stringify(next.dayTimePricing)) {
    await syncDayRules(branchId, next.dayTimePricing, auth);
  }
  if (JSON.stringify(prev.freeCoffeeRules) !== JSON.stringify(next.freeCoffeeRules)) {
    await syncCoffeeRules(branchId, next.freeCoffeeRules, auth);
  }
  if (JSON.stringify(prev.loyaltyProgram) !== JSON.stringify(next.loyaltyProgram)) {
    await syncLoyalty(branchId, next.loyaltyProgram, auth);
  }
  const prevSlot = {
    managerSlotDurationMinutes: prev.managerSlotDurationMinutes,
    slotBayOpenByWindow: prev.slotBayOpenByWindow ?? {},
    slotWindowActiveByKey: prev.slotWindowActiveByKey ?? {},
    slotDayStates: prev.slotDayStates ?? {},
  };
  const nextSlot = {
    managerSlotDurationMinutes: next.managerSlotDurationMinutes,
    slotBayOpenByWindow: next.slotBayOpenByWindow ?? {},
    slotWindowActiveByKey: next.slotWindowActiveByKey ?? {},
    slotDayStates: next.slotDayStates ?? {},
  };
  if (JSON.stringify(prevSlot) !== JSON.stringify(nextSlot)) {
    await syncSlotSettingsAdmin(branchId, next, auth);
  }
  if (JSON.stringify(prev.branchBookings) !== JSON.stringify(next.branchBookings)) {
    await syncBookingsAdmin(branchId, next.branchBookings, auth);
  }
}

export type ManagerCustomerLookupParams = { phone?: string; email?: string };

export async function managerLookupCustomer(params: ManagerCustomerLookupParams): Promise<Record<string, unknown> | null> {
  const auth = readAuth();
  if (!auth || auth.role !== 'manager') return null;
  const qs = new URLSearchParams();
  if (params.phone?.trim()) qs.set('phone', params.phone.trim());
  if (params.email?.trim()) qs.set('email', params.email.trim().toLowerCase());
  if (![...qs.keys()].length) return null;
  try {
    return await request<Record<string, unknown>>(`/manager/customer-lookup?${qs}`, undefined, auth);
  } catch {
    return null;
  }
}


export async function syncBranchDataToApi(
  branchId: string,
  prev: BranchData,
  next: BranchData,
  options?: BranchSyncOptions
): Promise<void> {
  return runBranchSyncSerialized(branchId, () => syncBranchDataToApiBody(branchId, prev, next, options));
}

export interface WasherUnavailabilityRecord {
  id: string;
  washer_id: string;
  date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
}

export async function managerFetchWasherUnavailability(date: string): Promise<WasherUnavailabilityRecord[]> {
  const auth = readAuth();
  if (!auth || auth.role !== 'manager') return [];
  try {
    return await request<WasherUnavailabilityRecord[]>(`/manager/washer-unavailability?date=${encodeURIComponent(date)}`, undefined, auth);
  } catch {
    return [];
  }
}
