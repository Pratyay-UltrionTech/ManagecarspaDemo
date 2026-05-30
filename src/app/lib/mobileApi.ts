import type {
  AddonItem,
  DayTimePriceRule,
  LoyaltyProgramConfig,
  PromoCode,
  VehicleServiceBlock,
} from './catalogShapeTypes';
import { coalesceServiceSequence, migrateServiceItem } from './catalogShapeTypes';
import {
  normalizeMobileManagerJobStatus,
  type MobileManagerJob,
  type MobileManagerJobStatus,
  type MobileOpsForPin,
  type MobileServiceManager,
  type MobileServiceStaff,
  type MobileServicesState,
} from './mobileServicesStore';
import { API_BASE } from './apiBase';
import { isBookingScheduleAndStaffLocked } from './managerPortalUtils';
const ADMIN_SESSION_KEY = 'carwash_admin_session_v1';
const MOBILE_MANAGER_SESSION_KEY = 'carwash_mobile_manager_session_v1';

type AuthContext =
  | { role: 'admin'; token: string }
  | { role: 'mobile_manager'; token: string; cityPinCode: string };

function readAuthContext(): AuthContext {
  const rawAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (rawAdmin) {
    const parsed = JSON.parse(rawAdmin) as { accessToken?: string };
    if (parsed?.accessToken) return { role: 'admin', token: parsed.accessToken };
  }
  const rawMobile = sessionStorage.getItem(MOBILE_MANAGER_SESSION_KEY);
  if (rawMobile) {
    const parsed = JSON.parse(rawMobile) as { accessToken?: string; cityPinCode?: string };
    if (parsed?.accessToken && parsed?.cityPinCode) {
      return { role: 'mobile_manager', token: parsed.accessToken, cityPinCode: pin(parsed.cityPinCode) };
    }
  }
  throw new Error('Authentication not found');
}

type RequestOptions = { treatDeleteNotFoundAsOk?: boolean };

/** Promo fields echoed in PATCH body — unchanged promos skip PATCH during bulk catalog sync. */
function mobilePromotionUnchanged(prev: PromoCode | undefined, nextP: PromoCode): boolean {
  if (!prev) return false;
  const key = (arr: readonly string[] | undefined) =>
    [...(arr ?? [])].map(String).sort().join('\u0001');
  return (
    prev.codeName === nextP.codeName &&
    prev.discountType === nextP.discountType &&
    Number(prev.discountValue) === Number(nextP.discountValue) &&
    prev.validityStart === nextP.validityStart &&
    prev.validityEnd === nextP.validityEnd &&
    prev.maxUsesPerCustomer === nextP.maxUsesPerCustomer &&
    key(prev.applicableServiceIds) === key(nextP.applicableServiceIds) &&
    key(prev.applicableVehicleTypes) === key(nextP.applicableVehicleTypes)
  );
}

function mapMobileJobStatusFromApi(
  raw: unknown,
  assignedDriverId?: string | null,
): MobileManagerJobStatus {
  const staffId =
    assignedDriverId == null || assignedDriverId === '' ? null : String(assignedDriverId);
  return normalizeMobileManagerJobStatus(raw, staffId);
}

export function buildMobileBookingPatchPayload(
  prev: MobileManagerJob | undefined,
  next: MobileManagerJob
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const setIfChanged = (apiKey: string, prevVal: unknown, nextVal: unknown) => {
    if (!prev || prevVal !== nextVal) patch[apiKey] = nextVal;
  };

  patch.status =
    next.assignedStaffId && next.status === 'scheduled' ? 'assigned' : next.status;
  if (!prev || prev.assignedStaffId !== next.assignedStaffId) {
    patch.assigned_driver_id = next.assignedStaffId ?? null;
  }
  setIfChanged('notes', prev?.notes ?? '', next.notes);
  setIfChanged('manager_notes', prev?.managerNotes ?? '', next.managerNotes ?? '');
  setIfChanged('customer_name', prev?.customerName ?? '', next.customerName);
  setIfChanged('phone', prev?.phone ?? '', next.phone);
  setIfChanged('address', prev?.address ?? '', next.address);
  setIfChanged('vehicle_type', prev?.vehicleType ?? '', next.vehicleType);
  setIfChanged('vehicle_summary', prev?.vehicleSummary ?? '', next.vehicleSummary);
  setIfChanged('service_id', prev?.serviceId ?? null, next.serviceId);
  setIfChanged('tip_cents', prev?.tipCents ?? 0, next.tipCents ?? 0);

  if (!prev || prev.slotDate !== next.slotDate) patch.slot_date = next.slotDate;
  if (!prev || prev.startTime !== next.startTime) patch.start_time = next.startTime;
  if (!prev || prev.endTime !== next.endTime) patch.end_time = next.endTime;

  const prevAddons = prev?.selectedAddonIds ?? [];
  const nextAddons = next.selectedAddonIds ?? [];
  if (
    !prev ||
    prevAddons.length !== nextAddons.length ||
    prevAddons.some((id, i) => id !== nextAddons[i])
  ) {
    patch.selected_addon_ids = nextAddons;
  }

  if (prev && isBookingScheduleAndStaffLocked(prev.status)) {
    delete patch.slot_date;
    delete patch.start_time;
    delete patch.end_time;
    delete patch.assigned_driver_id;
  }

  return patch;
}

export function buildMobileBookingStatusPatch(
  job: MobileManagerJob,
  nextStatus: MobileManagerJobStatus
): Record<string, unknown> {
  const status =
    job.assignedStaffId && nextStatus === 'scheduled' ? 'assigned' : nextStatus;
  const patch: Record<string, unknown> = { status };
  if (job.assignedStaffId) patch.assigned_driver_id = job.assignedStaffId;
  return patch;
}

/** Persist a single booking field update without bulk state sync. */
export async function patchMobileManagerBooking(
  bookingId: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (Object.keys(payload).length === 0) return;
  await request(`/manager/mobile/bookings/${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const auth = readAuthContext();
  const token = auth.token;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    const hint =
      err instanceof TypeError
        ? ' Network error — ensure the API is running (e.g. http://localhost:8000) and restart it after updates.'
        : '';
    throw new Error(`Could not reach the server.${hint}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (options?.treatDeleteNotFoundAsOk && init?.method === 'DELETE' && res.status === 404) {
      return undefined as T;
    }
    const detailPayload = typeof data?.detail === 'object' && data?.detail ? data.detail : {};
    const msg =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof detailPayload?.detail === 'string'
          ? detailPayload.detail
          : `API ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

async function deleteSyncResource(path: string): Promise<void> {
  await request(path, { method: 'DELETE' }, { treatDeleteNotFoundAsOk: true });
}

function createMobileSyncQueue() {
  let chain: Promise<unknown> = Promise.resolve();
  let generation = 0;
  return {
    invalidate() {
      generation += 1;
    },
    flush(): Promise<void> {
      return chain.then(() => undefined);
    },
    enqueue<T>(fn: () => Promise<T>): Promise<T> {
      const gen = generation;
      const result = chain.then(async () => {
        if (gen !== generation) return undefined as T;
        return fn();
      });
      chain = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    },
  };
}

const mobileSyncQueue = createMobileSyncQueue();
const enqueueMobileSync = mobileSyncQueue.enqueue.bind(mobileSyncQueue);

/** Drop queued background syncs that still carry stale slot_day_states (e.g. after delete). */
export function invalidatePendingMobileSync(): void {
  mobileSyncQueue.invalidate();
}

/** Wait until in-flight queued syncs finish (skipped stale jobs resolve immediately). */
export function flushMobileSyncQueue(): Promise<void> {
  return mobileSyncQueue.flush();
}

const pin = (v: string) => String(v ?? '').replace(/\D/g, '').slice(0, 6);
const toMoney = (v: unknown) => Math.round((Number(v ?? 0) + Number.EPSILON) * 100) / 100;

function mapManager(raw: any): MobileServiceManager {
  return {
    id: String(raw.id ?? ''),
    pinCode: pin(raw.city_pin_code ?? raw.pin_code ?? ''),
    empName: String(raw.emp_name ?? ''),
    address: String(raw.address ?? ''),
    zipCode: String(raw.zip_code ?? ''),
    email: String(raw.email ?? ''),
    mobile: String(raw.mobile ?? ''),
    doj: String(raw.doj ?? ''),
    loginId: String(raw.login_id ?? ''),
    password: '',
    active: raw.active !== false,
  };
}

function mapStaff(raw: any): MobileServiceStaff {
  return {
    id: String(raw.id ?? ''),
    cityPinCode: pin(raw.city_pin_code ?? ''),
    servicePinCode: pin(raw.service_pin_code ?? ''),
    empName: String(raw.emp_name ?? ''),
    address: String(raw.address ?? ''),
    zipCode: String(raw.zip_code ?? ''),
    serviceableZipCodes: Array.isArray(raw.serviceable_zip_codes) ? raw.serviceable_zip_codes.map(String) : [],
    email: String(raw.email ?? ''),
    mobile: String(raw.mobile ?? ''),
    doj: String(raw.doj ?? ''),
    loginId: String(raw.login_id ?? ''),
    password: '',
    active: raw.active !== false,
  };
}

function mapVehicleBlocks(raw: any[]): VehicleServiceBlock[] {
  return (raw ?? []).map((b: any) => ({
    vehicleType: String(b.vehicle_type ?? ''),
    services: Array.isArray(b.services) ? b.services.map((s: any) => migrateServiceItem(s)) : [],
    addons: [] as AddonItem[],
  }));
}

function mapMobileAddons(raw: any[]): AddonItem[] {
  return (raw ?? []).map((a: any) => ({
    id: String(a.id ?? ''),
    name: String(a.name ?? ''),
    price: Number(a.price ?? 0),
    descriptionPoints: Array.isArray(a.description_points) ? a.description_points.map(String) : [],
    active: a.active !== false,
  }));
}

function mapPromotions(raw: any[]): PromoCode[] {
  return (raw ?? []).map((p: any) => ({
    id: String(p.id ?? ''),
    codeName: String(p.code_name ?? ''),
    discountType: p.discount_type === 'percentage' ? 'percentage' : 'flat',
    discountValue: toMoney(p.discount_value),
    validityStart: String(p.validity_start ?? ''),
    validityEnd: String(p.validity_end ?? ''),
    maxUsesPerCustomer: Number(p.max_uses_per_customer ?? 1),
    applicableServiceIds: Array.isArray(p.applicable_service_ids) ? p.applicable_service_ids.map(String) : [],
    applicableVehicleTypes: Array.isArray(p.applicable_vehicle_types) ? p.applicable_vehicle_types.map(String) : [],
  }));
}

function mapDayRules(raw: any[]): DayTimePriceRule[] {
  return (raw ?? []).map((r: any) => ({
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    discountType: r.discount_type === 'percentage' ? 'percentage' : 'flat',
    discountValue: toMoney(r.discount_value),
    applicableServiceIds: Array.isArray(r.applicable_service_ids) ? r.applicable_service_ids.map(String) : [],
    applicableVehicleTypes: Array.isArray(r.applicable_vehicle_types) ? r.applicable_vehicle_types.map(String) : [],
    applicableDays: Array.isArray(r.applicable_days) ? r.applicable_days.map(String) : [],
    timeWindowStart: String(r.time_window_start ?? ''),
    timeWindowEnd: String(r.time_window_end ?? ''),
    validityStart: String(r.validity_start ?? ''),
    validityEnd: String(r.validity_end ?? ''),
  }));
}

function mapLoyalty(raw: any): LoyaltyProgramConfig {
  return {
    qualifyingServiceCount: Number(raw?.qualifying_service_count ?? 10),
    tiers: Array.isArray(raw?.tiers)
      ? raw.tiers.map((t: any) => ({
          id: String(t.id ?? ''),
          minSpendInWindow: Number(t.minSpendInWindow ?? 0),
          maxSpendInWindow: t.maxSpendInWindow == null ? null : Number(t.maxSpendInWindow),
          rewardServiceId: String(t.rewardServiceId ?? ''),
        }))
      : [],
  };
}

function mapOps(raw: any): MobileOpsForPin {
  return {
    slotDurationMinutes: Number(raw?.slot_duration_minutes ?? 60),
    openTime: String(raw?.open_time ?? '08:00'),
    closeTime: String(raw?.close_time ?? '18:00'),
    jobs: [],
    slotWindowActiveByKey: raw?.slot_window_active_by_key ?? undefined,
    slotDriverOpenByWindow: raw?.slot_driver_open_by_window ?? undefined,
    slotDayStates: raw?.slot_day_states ?? undefined,
  };
}

export async function fetchMobileServicesStateFromApi(): Promise<MobileServicesState> {
  const auth = readAuthContext();
  if (auth.role === 'mobile_manager') {
    const [driversRaw, bookingsRaw, slotRaw, snapshot] = await Promise.all([
      request<any[]>('/manager/mobile/drivers'),
      request<any[]>('/manager/mobile/bookings'),
      request<any>('/manager/mobile/slot-settings'),
      request<any>(`/public/mobile/snapshot?pin_code=${encodeURIComponent(auth.cityPinCode)}`),
    ]);
    const managerPin = pin(auth.cityPinCode);
    return {
      managersByPin: {
        [managerPin]: {
          id: String(snapshot?.service_area?.manager_id ?? ''),
          pinCode: managerPin,
          empName: String(snapshot?.service_area?.manager_name ?? ''),
          address: '',
          zipCode: managerPin,
          email: '',
          mobile: '',
          doj: '',
          loginId: '',
          password: '',
          active: true,
        },
      },
      staff: driversRaw.map(mapStaff),
      vehicleCatalog: mapVehicleBlocks(snapshot?.vehicle_blocks ?? []),
      mobileAddons: mapMobileAddons(snapshot?.mobile_addons ?? []),
      promotions: mapPromotions(snapshot?.promotions ?? []),
      dayTimePricing: mapDayRules(snapshot?.day_time_rules ?? []),
      loyaltyProgram: mapLoyalty(snapshot?.loyalty ?? null),
      mobileOpsByPin: {
        [managerPin]: {
          ...mapOps(slotRaw),
          jobs: (bookingsRaw ?? []).map((b: any) => ({
            id: String(b.id ?? ''),
            customerName: String(b.customer_name ?? ''),
            phone: String(b.phone ?? ''),
            vehicleSummary: String(b.vehicle_summary ?? ''),
            address: String(b.address ?? ''),
            serviceId: b.service_id == null ? null : String(b.service_id),
            vehicleType: String(b.vehicle_type ?? ''),
            vehicleName: String(b.vehicle_model ?? ''),
            registrationNumber: String(b.registration_number ?? ''),
            slotDate: String(b.slot_date ?? ''),
            startTime: String(b.start_time ?? ''),
            endTime: String(b.end_time ?? ''),
            assignedStaffId: b.assigned_driver_id == null ? null : String(b.assigned_driver_id),
            status: mapMobileJobStatusFromApi(b.status, b.assigned_driver_id),
            notes: String(b.notes ?? ''),
            managerNotes: String(b.manager_notes ?? ''),
            selectedAddonIds: Array.isArray(b.selected_addon_ids) ? b.selected_addon_ids.map(String) : [],
            tipCents: Number(b.tip_cents ?? 0) || 0,
            createdAt: String(b.created_at ?? new Date().toISOString()),
            requestedZipCode: String(b.requested_zip_code ?? ''),
            customerId: b.customer_id ? String(b.customer_id) : null,
          })),
        },
      },
    };
  }

  const [managersRaw, staffRaw, blocksRaw, addonsRaw, promosRaw, dayRulesRaw, loyaltyRaw] = await Promise.all([
    request<any[]>('/admin/mobile/managers'),
    request<any[]>('/admin/mobile/drivers'),
    request<any[]>('/admin/mobile/vehicle-blocks'),
    request<any[]>('/admin/mobile/addons'),
    request<any[]>('/admin/mobile/promotions'),
    request<any[]>('/admin/mobile/day-time-rules'),
    request<any>('/admin/mobile/loyalty'),
  ]);
  const managers = managersRaw.map(mapManager);
  const opsEntries = await Promise.all(
    managers.map(async (m) => {
      try {
        const settings = await request<any>(`/admin/mobile/slot-settings/${m.pinCode}`);
        return [m.pinCode, mapOps(settings)] as const;
      } catch {
        return [m.pinCode, mapOps(null)] as const;
      }
    })
  );
  return {
    managersByPin: Object.fromEntries(managers.map((m) => [m.pinCode, m])),
    staff: staffRaw.map(mapStaff),
    vehicleCatalog: mapVehicleBlocks(blocksRaw),
    mobileAddons: mapMobileAddons(addonsRaw),
    promotions: mapPromotions(promosRaw),
    dayTimePricing: mapDayRules(dayRulesRaw),
    loyaltyProgram: mapLoyalty(loyaltyRaw),
    mobileOpsByPin: Object.fromEntries(opsEntries),
  };
}

type MobileSyncOptions = { syncJobs?: boolean };

async function syncMobileServicesStateToApiBody(
  prev: MobileServicesState,
  next: MobileServicesState,
  options?: MobileSyncOptions
): Promise<void> {
  const auth = readAuthContext();
  if (auth.role === 'mobile_manager') {
    const pinCode = pin(auth.cityPinCode);
    const prevOps = prev.mobileOpsByPin[pinCode] ?? prev.mobileOpsByPin[auth.cityPinCode];
    const nextOps = next.mobileOpsByPin[pinCode] ?? next.mobileOpsByPin[auth.cityPinCode];
    if (!nextOps) return;

    const prevSlot = {
      slot_duration_minutes: prevOps?.slotDurationMinutes,
      open_time: prevOps?.openTime,
      close_time: prevOps?.closeTime,
      slot_window_active_by_key: prevOps?.slotWindowActiveByKey ?? {},
      slot_driver_open_by_window: prevOps?.slotDriverOpenByWindow ?? {},
      slot_day_states: prevOps?.slotDayStates ?? {},
    };
    const nextSlot = {
      slot_duration_minutes: nextOps.slotDurationMinutes,
      open_time: nextOps.openTime,
      close_time: nextOps.closeTime,
      slot_window_active_by_key: nextOps.slotWindowActiveByKey ?? {},
      slot_driver_open_by_window: nextOps.slotDriverOpenByWindow ?? {},
      slot_day_states: nextOps.slotDayStates ?? {},
    };
    if (JSON.stringify(prevSlot) !== JSON.stringify(nextSlot)) {
      await request('/manager/mobile/slot-settings', {
        method: 'PATCH',
        body: JSON.stringify(nextSlot),
      });
    }

    if (options?.syncJobs === false) return;
    if (JSON.stringify(prevOps?.jobs) === JSON.stringify(nextOps.jobs)) return;

    const currentBookings = await request<any[]>('/manager/mobile/bookings');
    const currentById = new Map(currentBookings.map((b) => [String(b.id), b] as const));
    const nextById = new Map((nextOps.jobs ?? []).map((j) => [j.id, j] as const));
    const prevById = new Map((prevOps?.jobs ?? []).map((j) => [j.id, j] as const));

    for (const [id, j] of nextById.entries()) {
      if (currentById.has(id)) {
        // Only PATCH if this job actually changed from prev state.
        const prevJ = prevById.get(id);
        if (JSON.stringify(prevJ) === JSON.stringify(j)) continue;
        const patchPayload = buildMobileBookingPatchPayload(prevJ, j);
        if (Object.keys(patchPayload).length === 0) continue;
        await request(`/manager/mobile/bookings/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload),
        });
      } else {
        await request('/manager/mobile/bookings', {
          method: 'POST',
          body: JSON.stringify({
            booking_id: j.id,
            customer_name: j.customerName,
            phone: j.phone,
            customer_email: j.email ?? '',
            address: j.address,
            vehicle_summary: j.vehicleSummary,
            service_id: j.serviceId,
            vehicle_type: j.vehicleType,
            vehicle_model: j.vehicleName ?? '',
            registration_number: j.registrationNumber ?? '',
            selected_addon_ids: j.selectedAddonIds ?? [],
            slot_date: j.slotDate,
            start_time: j.startTime,
            end_time: j.endTime,
            assigned_driver_id: j.assignedStaffId,
            status:
              j.assignedStaffId && j.status === 'scheduled' ? 'assigned' : j.status || 'scheduled',
            source: 'walk_in',
            customer_id: j.customerId ?? null,
            notes: j.notes,
            manager_notes: j.managerNotes ?? '',
            tip_cents: j.tipCents ?? 0,
            ...(j.serviceChargedCents != null
              ? { service_charged_cents: Math.max(0, Math.floor(j.serviceChargedCents)) }
              : {}),
          }),
        });
      }
    }
    return;
  }

  const current = await fetchMobileServicesStateFromApi();

  const managersChanged = JSON.stringify(prev.managersByPin) !== JSON.stringify(next.managersByPin);
  const staffChanged = JSON.stringify(prev.staff) !== JSON.stringify(next.staff);

  if (managersChanged) {
    const curManagersByPin = current.managersByPin;
    const nextManagersByPin = next.managersByPin;
    for (const [pinCode, mgr] of Object.entries(nextManagersByPin)) {
      const existing = curManagersByPin[pinCode];
      const body = {
        city_pin_code: pinCode,
        emp_name: mgr.empName,
        address: mgr.address,
        zip_code: mgr.zipCode,
        email: mgr.email,
        mobile: mgr.mobile,
        doj: mgr.doj,
        login_id: mgr.loginId,
        active: mgr.active,
        ...(mgr.password ? { password: mgr.password } : {}),
      };
      if (existing?.id) {
        await request(`/admin/mobile/managers/${existing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await request('/admin/mobile/managers', { method: 'POST', body: JSON.stringify({ ...body, password: mgr.password || 'ChangeMe@123' }) });
      }
    }
    for (const [pinCode, mgr] of Object.entries(curManagersByPin)) {
      if (!next.managersByPin[pinCode] && mgr.id) {
        await deleteSyncResource(`/admin/mobile/managers/${mgr.id}`);
      }
    }
  }

  if (staffChanged) {
    const currentDriversById = new Map(current.staff.map((s) => [s.id, s] as const));
    const nextDriverIds = new Set(next.staff.map((s) => s.id));
    for (const s of next.staff) {
      const body = {
        city_pin_code: s.cityPinCode,
        service_pin_code: s.servicePinCode,
        emp_name: s.empName,
        address: s.address,
        zip_code: s.zipCode,
        serviceable_zip_codes: s.serviceableZipCodes ?? [],
        email: s.email,
        mobile: s.mobile,
        doj: s.doj,
        login_id: s.loginId,
        active: s.active,
        ...(s.password ? { password: s.password } : {}),
      };
      if (currentDriversById.has(s.id)) {
        await request(`/admin/mobile/drivers/${s.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await request('/admin/mobile/drivers', { method: 'POST', body: JSON.stringify({ ...body, password: s.password || 'ChangeMe@123' }) });
      }
    }
    for (const s of current.staff) {
      if (!nextDriverIds.has(s.id)) {
        await deleteSyncResource(`/admin/mobile/drivers/${s.id}`);
      }
    }
  }

  const currentBlocksByType = new Map(current.vehicleCatalog.map((b) => [b.vehicleType, b] as const));
  const currentBlocksRaw = await request<any[]>('/admin/mobile/vehicle-blocks');
  const currentBlockIdByType = new Map(currentBlocksRaw.map((b) => [String(b.vehicle_type ?? ''), String(b.id ?? '')] as const));
  const nextVehicleTypes = new Set(next.vehicleCatalog.map((b) => b.vehicleType));
  for (const b of next.vehicleCatalog) {
    const body = {
      vehicle_type: b.vehicleType,
      services: (b.services ?? []).map((s) => ({
        id: s.id,
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
        category: s.category ?? 'Washing',
        sequence: coalesceServiceSequence(s.sequence),
      })),
      addons: [],
    };
    const existingId = currentBlockIdByType.get(b.vehicleType);
    if (existingId) {
      await request(`/admin/mobile/vehicle-blocks/${existingId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await request('/admin/mobile/vehicle-blocks', { method: 'POST', body: JSON.stringify(body) });
    }
  }
  for (const [vehicleType, rawId] of currentBlockIdByType.entries()) {
    if (!nextVehicleTypes.has(vehicleType) && rawId) {
      await deleteSyncResource(`/admin/mobile/vehicle-blocks/${rawId}`);
    }
  }

  await request('/admin/mobile/addons', {
    method: 'PUT',
    body: JSON.stringify({
      items: (next.mobileAddons ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        price: a.price,
        description_points: a.descriptionPoints ?? [],
        active: a.active !== false,
      })),
    }),
  });

  // Only sync promotions when they have actually changed — avoids race-condition
  // where a queued catalog sync (triggered by a slot toggle, etc.) runs after a
  // concurrent per-item delete and erroneously re-creates the deleted record.
  const promosChanged = JSON.stringify(prev.promotions) !== JSON.stringify(next.promotions);
  if (promosChanged) {
    const curPromos = await request<any[]>('/admin/mobile/promotions');
    const curPromoIds = new Set(curPromos.map((p) => String(p.id)));
    const nextPromoIds = new Set(next.promotions.map((p) => p.id));
    const prevPromoById = new Map(prev.promotions.map((p) => [p.id, p] as const));
    for (const p of next.promotions) {
      const body = {
        id: p.id,
        code_name: p.codeName,
        discount_type: p.discountType,
        discount_value: toMoney(p.discountValue),
        validity_start: p.validityStart,
        validity_end: p.validityEnd,
        max_uses_per_customer: p.maxUsesPerCustomer,
        applicable_service_ids: p.applicableServiceIds ?? [],
        applicable_vehicle_types: p.applicableVehicleTypes ?? [],
      };
      if (p.id && curPromoIds.has(p.id)) {
        if (mobilePromotionUnchanged(prevPromoById.get(p.id), p)) continue;
        await request(`/admin/mobile/promotions/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await request('/admin/mobile/promotions', { method: 'POST', body: JSON.stringify(body) });
      }
    }
    for (const p of curPromos) {
      const id = String(p.id);
      if (!nextPromoIds.has(id)) await deleteSyncResource(`/admin/mobile/promotions/${id}`);
    }
  }

  // Same guard for day/time pricing rules.
  const dayRulesChanged = JSON.stringify(prev.dayTimePricing) !== JSON.stringify(next.dayTimePricing);
  if (dayRulesChanged) {
    const curDay = await request<any[]>('/admin/mobile/day-time-rules');
    const curDayIds = new Set(curDay.map((r) => String(r.id)));
    const nextDayIds = new Set(next.dayTimePricing.map((r) => r.id));
    for (const r of next.dayTimePricing) {
      const body = {
        id: r.id,
        title: r.title,
        description: r.description,
        discount_type: r.discountType,
        discount_value: toMoney(r.discountValue),
        applicable_service_ids: r.applicableServiceIds ?? [],
        applicable_vehicle_types: r.applicableVehicleTypes ?? [],
        applicable_days: r.applicableDays ?? [],
        time_window_start: r.timeWindowStart,
        time_window_end: r.timeWindowEnd,
        validity_start: r.validityStart,
        validity_end: r.validityEnd,
      };
      if (r.id && curDayIds.has(r.id)) await request(`/admin/mobile/day-time-rules/${r.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await request('/admin/mobile/day-time-rules', { method: 'POST', body: JSON.stringify(body) });
    }
    for (const r of curDay) {
      const id = String(r.id);
      if (!nextDayIds.has(id)) await deleteSyncResource(`/admin/mobile/day-time-rules/${id}`);
    }
  }

  await request('/admin/mobile/loyalty', {
    method: 'PUT',
    body: JSON.stringify({
      qualifying_service_count: next.loyaltyProgram.qualifyingServiceCount,
      tiers: (next.loyaltyProgram.tiers ?? []).map((t) => ({
        id: t.id,
        min_spend_in_window: t.minSpendInWindow,
        max_spend_in_window: t.maxSpendInWindow,
        reward_service_id: t.rewardServiceId,
      })),
    }),
  });

  for (const [cityPinCode, ops] of Object.entries(next.mobileOpsByPin ?? {})) {
    await request(`/admin/mobile/slot-settings/${cityPinCode}`, {
      method: 'PATCH',
      body: JSON.stringify({
        slot_duration_minutes: ops.slotDurationMinutes,
        open_time: ops.openTime,
        close_time: ops.closeTime,
        slot_window_active_by_key: ops.slotWindowActiveByKey ?? {},
        slot_driver_open_by_window: ops.slotDriverOpenByWindow ?? {},
        slot_day_states: ops.slotDayStates ?? {},
      }),
    });
  }
}

/** Persist slot calendar settings only (no booking job sync). */
export async function patchMobileManagerSlotSettingsFromOps(ops: MobileOpsForPin): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'mobile_manager') {
    throw new Error('Mobile manager authentication required');
  }
  await request('/manager/mobile/slot-settings', {
    method: 'PATCH',
    body: JSON.stringify({
      slot_duration_minutes: ops.slotDurationMinutes,
      open_time: ops.openTime,
      close_time: ops.closeTime,
      slot_window_active_by_key: ops.slotWindowActiveByKey ?? {},
      slot_driver_open_by_window: ops.slotDriverOpenByWindow ?? {},
      slot_day_states: ops.slotDayStates ?? {},
    }),
  });
}

export async function syncMobileServicesStateToApi(
  prev: MobileServicesState,
  next: MobileServicesState,
  options?: MobileSyncOptions
): Promise<void> {
  return enqueueMobileSync(() => syncMobileServicesStateToApiBody(prev, next, options));
}

export async function deleteMobileManagerFromApi(managerId: string): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/mobile/managers/${managerId}`, { method: 'DELETE' });
}

export async function deleteMobileDriverFromApi(driverId: string): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/mobile/drivers/${driverId}`, { method: 'DELETE' });
}

export async function deleteMobileAddonFromApi(addonId: string): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/mobile/addons/${addonId}`, { method: 'DELETE' });
}

export async function saveMobileAddonToApi(addon: AddonItem): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
  const existing = await request<any[]>('/admin/mobile/addons');
  const nextItems = (() => {
    const normalized = {
      id: addon.id,
      name: addon.name,
      price: addon.price,
      description_points: addon.descriptionPoints ?? [],
      active: addon.active !== false,
    };
    const idx = existing.findIndex((x) => String(x.id) === addon.id);
    if (idx >= 0) {
      return existing.map((x, i) => (i === idx ? normalized : x));
    }
    return [...existing, normalized];
  })();
  await request('/admin/mobile/addons', {
    method: 'PUT',
    body: JSON.stringify({ items: nextItems }),
  });
}

export async function deleteMobilePromotionFromApi(promoId: string): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/mobile/promotions/${promoId}`, { method: 'DELETE' });
}

export async function saveMobilePromotionToApi(promo: PromoCode): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
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
  const existing = await request<any[]>('/admin/mobile/promotions');
  const exists = existing.some((x) => String(x.id) === promo.id);
  if (exists) {
    await request(`/admin/mobile/promotions/${promo.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return;
  }
  await request('/admin/mobile/promotions', { method: 'POST', body: JSON.stringify(body) });
}

export async function deleteMobileDayRuleFromApi(ruleId: string): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
  await request(`/admin/mobile/day-time-rules/${ruleId}`, { method: 'DELETE' });
}

export async function saveMobileDayRuleToApi(rule: DayTimePriceRule): Promise<void> {
  const auth = readAuthContext();
  if (auth.role !== 'admin') throw new Error('Admin authentication required');
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
  const existing = await request<any[]>('/admin/mobile/day-time-rules');
  const exists = existing.some((x) => String(x.id) === rule.id);
  if (exists) {
    await request(`/admin/mobile/day-time-rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return;
  }
  await request('/admin/mobile/day-time-rules', { method: 'POST', body: JSON.stringify(body) });
}

export type MobileManagerLookupParams = { phone?: string; email?: string };

/** Customer profile for create-booking autofill (mobile manager JWT). */
export async function mobileManagerLookupCustomer(
  params: MobileManagerLookupParams
): Promise<Record<string, unknown> | null> {
  const qs = new URLSearchParams();
  if (params.phone?.trim()) qs.set('phone', params.phone.trim());
  if (params.email?.trim()) qs.set('email', params.email.trim().toLowerCase());
  if (![...qs.keys()].length) return null;
  let token: string | null = null;
  try {
    const raw = sessionStorage.getItem(MOBILE_MANAGER_SESSION_KEY);
    const p = JSON.parse(raw ?? '{}') as { accessToken?: string };
    token = p.accessToken ?? null;
  } catch {
    token = null;
  }
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/manager/mobile/customer-lookup?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return null;
    return data;
  } catch {
    return null;
  }
}
