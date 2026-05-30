import { API_BASE } from './apiBase';
import { readAdminSessionFromStorage } from './adminSession';

function adminToken(): string {
  return readAdminSessionFromStorage()?.accessToken ?? '';
}

async function adminGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${adminToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.detail === 'string' ? data.detail : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export interface CustomerRow {
  type: 'account' | 'guest';
  customer_id: string | null;
  guest_key: string | null;
  name: string;
  email: string | null;
  phone: string;
  vehicles: string[];
  branch_booking_count: number;
  mobile_booking_count: number;
  total_booking_count: number;
  last_booking_date: string | null;
}

export interface CustomerListResponse {
  total: number;
  page: number;
  per_page: number;
  customers: CustomerRow[];
}

export interface CustomerBooking {
  source: 'branch' | 'mobile';
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  service_summary: string;
  vehicle_type: string;
  vehicle_model: string;
  registration_number: string;
  addon_names: string[];
  assigned_staff_name: string;
  service_total_cents: number;
  tip_cents: number;
  status: string;
  payment_method: string;
  /** Present for registered account bookings. */
  customer_id?: string | null;
  /** Phone number — used to derive the guest booking ID suffix when customer_id is absent. */
  phone?: string;
}

export type CustomerSortBy =
  | 'recently_created_booking'
  | 'recent_booking'
  | 'oldest_booking'
  | 'name_asc'
  | 'name_desc'
  | 'latest_created'
  | 'most_bookings';

export async function adminListCustomers(opts: {
  search?: string;
  typeFilter?: 'all' | 'account' | 'guest';
  sortBy?: CustomerSortBy;
  page?: number;
  perPage?: number;
}): Promise<CustomerListResponse> {
  return adminGet<CustomerListResponse>('/admin/customers', {
    search: opts.search ?? '',
    type_filter: opts.typeFilter ?? 'all',
    sort_by: opts.sortBy ?? 'recently_created_booking',
    page: String(opts.page ?? 1),
    per_page: String(opts.perPage ?? 50),
  });
}

export async function adminGetCustomerBookings(opts: {
  customerId?: string;
  phone?: string;
  name?: string;
}): Promise<CustomerBooking[]> {
  return adminGet<CustomerBooking[]>('/admin/customers/bookings', {
    customer_id: opts.customerId ?? '',
    phone: opts.phone ?? '',
    name: opts.name ?? '',
  });
}
