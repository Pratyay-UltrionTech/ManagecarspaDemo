import { useState, useEffect, useCallback, useRef } from 'react';
import {
  adminListCustomers,
  adminGetCustomerBookings,
  type CustomerRow,
  type CustomerBooking,
  type CustomerSortBy,
} from '../lib/customersApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Single-line date for table cells (avoids "30 May" / "2026" wrap in narrow columns). */
function fmtDateTable(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(t?: string): string {
  if (!t) return '';
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '—';
  const s = raw.trim();
  if (!s) return '—';
  if (s.startsWith('+')) return s.replace(/^\+61(\d)/, '+61-$1');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+61-${digits.slice(1)}`;
  if (digits.length === 9) return `+61-${digits}`;
  return s;
}

/** Derives a 6-char alphanumeric code from a phone number (base-36 of last 9 digits). */
function guestCode(guestKey: string): string {
  const digits = (guestKey ?? '').replace(/\D/g, '');
  if (!digits) return 'XXXXXX';
  const num = parseInt(digits.slice(-9), 10);
  return num.toString(36).toUpperCase().slice(-6).padStart(6, '0');
}

/** Derives a 4-char alphanumeric suffix from a phone number — last 4 chars of guestCode. */
function guestSuffix(phone: string): string {
  return guestCode(phone).slice(-4);
}

function shortCode(bookingId: string, customerId?: string | null, guestPhone?: string): string {
  const hex = bookingId.replace(/-/g, '').slice(-6).toUpperCase();
  if (customerId) {
    const cid = customerId.replace(/-/g, '').slice(-4).toUpperCase();
    return `${hex}-${cid}`;
  }
  if (guestPhone) {
    return `${hex}-${guestSuffix(guestPhone)}`;
  }
  return hex;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned: 'bg-sky-50 text-sky-700 border-sky-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  arrived: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Booking History Modal ─────────────────────────────────────────────────────

interface BookingHistoryModalProps {
  customer: CustomerRow;
  onClose: () => void;
}

function BookingHistoryModal({ customer, onClose }: BookingHistoryModalProps) {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    adminGetCustomerBookings({
      customerId: customer.customer_id ?? undefined,
      phone: customer.phone || undefined,
      name: customer.name || undefined,
    })
      .then(setBookings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [customer]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)' }}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900">{customer.name || 'Unknown'}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-slate-500">
              {customer.email && <span>{customer.email}</span>}
              {customer.phone && <span>{formatPhone(customer.phone)}</span>}
              <span className={`font-medium ${customer.type === 'account' ? 'text-indigo-600' : 'text-amber-600'}`}>
                {customer.type === 'account' ? 'Registered Account' : 'Guest'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
          )}
          {!loading && error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {!loading && !error && bookings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <svg className="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No bookings found</p>
            </div>
          )}
          {!loading && !error && bookings.length > 0 && (
            <div className="space-y-4">
              {bookings.map((b) => {
                const total = b.service_total_cents + b.tip_cents;
                return (
                  <div key={b.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    {/* Row 1: code + source + status */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-500 tracking-widest">
                          {shortCode(b.id, b.customer_id ?? customer.customer_id, customer.type === 'guest' ? (b.phone || customer.phone) : undefined)}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          b.source === 'branch'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                            : 'border-cyan-200 bg-cyan-50 text-cyan-600'
                        }`}>
                          {b.source === 'branch' ? 'Branch' : 'Mobile'}
                        </span>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>

                    {/* Row 2: date + time */}
                    <p className="mb-2 text-[13px] font-semibold text-slate-800">
                      {fmtDate(b.slot_date)}
                      {b.start_time && (
                        <span className="ml-2 font-normal text-slate-500">
                          {fmtTime(b.start_time)}{b.end_time ? ` – ${fmtTime(b.end_time)}` : ''}
                        </span>
                      )}
                    </p>

                    <div className="space-y-1.5 text-[12px] text-slate-600">
                      {/* Service — strip the " + addon1, addon2" suffix that the
                          backend appends to service_summary so add-ons aren't shown twice */}
                      {b.service_summary && (
                        <div className="flex gap-2">
                          <span className="w-20 shrink-0 font-medium text-slate-500">Service</span>
                          <span className="text-slate-800">
                            {(() => {
                              if (!b.addon_names.length) return b.service_summary;
                              const addonSuffix = ' + ' + b.addon_names.join(', ');
                              return b.service_summary.endsWith(addonSuffix)
                                ? b.service_summary.slice(0, -addonSuffix.length)
                                : b.service_summary.split(' + ')[0];
                            })()}
                          </span>
                        </div>
                      )}

                      {/* Vehicle — registration same font size as vehicle name */}
                      {(b.vehicle_type || b.vehicle_model || b.registration_number) && (
                        <div className="flex gap-2">
                          <span className="w-20 shrink-0 font-medium text-slate-500">Vehicle</span>
                          <span className="text-slate-800">
                            {[b.vehicle_type, b.vehicle_model, b.registration_number].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      )}

                      {/* Add-ons */}
                      {b.addon_names.length > 0 && (
                        <div className="flex gap-2">
                          <span className="w-20 shrink-0 font-medium text-slate-500">Add-ons</span>
                          <span className="text-slate-800">{b.addon_names.join(', ')}</span>
                        </div>
                      )}

                      {/* Staff */}
                      {b.assigned_staff_name && (
                        <div className="flex gap-2">
                          <span className="w-20 shrink-0 font-medium text-slate-500">
                            {b.source === 'branch' ? 'Washer' : 'Driver'}
                          </span>
                          <span className="text-slate-800">{b.assigned_staff_name}</span>
                        </div>
                      )}

                      {/* Payment — service_charged_cents matches user portal / manager checkout */}
                      <div className="flex gap-2">
                        <span className="w-20 shrink-0 font-medium text-slate-500">Payment</span>
                        <span className="text-slate-800">
                          {fmtMoney(b.service_total_cents)}
                          {b.tip_cents > 0 && (
                            <span className="ml-1 text-emerald-600">+ {fmtMoney(b.tip_cents)} tip</span>
                          )}
                          <span className="ml-1 font-medium text-slate-700">
                            ({fmtMoney(total)} total)
                          </span>
                          <span className="ml-1 capitalize text-slate-500">· {b.payment_method}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && bookings.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-[12px] text-slate-400">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''} total
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'account' | 'guest'>('all');
  const [sortBy, setSortBy] = useState<CustomerSortBy>('recently_created_booking');
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  const fetchCustomers = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminListCustomers({ search, typeFilter, sortBy, page: pageOverride ?? page, perPage: PER_PAGE });
      setCustomers(res.customers);
      setTotal(res.total);
    } catch (e: any) {
      setError(e.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, sortBy, page]);

  // When filters change: reset to page 1 and fetch in one shot (avoids double-fetch).
  const prevFiltersRef = useRef({ search, typeFilter, sortBy });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged = prev.search !== search || prev.typeFilter !== typeFilter || prev.sortBy !== sortBy;
    prevFiltersRef.current = { search, typeFilter, sortBy };

    if (filtersChanged) {
      // Filters changed — reset page and fetch page 1 directly.
      setPage(1);
      const t = window.setTimeout(() => void fetchCustomers(1), search !== prev.search ? 300 : 0);
      return () => window.clearTimeout(t);
    } else {
      // Only page changed — fetch immediately.
      void fetchCustomers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, sortBy, page]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Customers</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          View and search all customers — registered accounts and guest bookings.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, ID…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>

        {/* Type filter */}
        <div className="flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden text-sm">
          {(['all', 'account', 'guest'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'all' ? 'All' : t === 'account' ? 'Registered' : 'Guest'}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m8 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CustomerSortBy)}
            className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="recently_created_booking">Recently booked</option>
            <option value="recent_booking">Recent slot date</option>
            <option value="oldest_booking">Oldest booking</option>
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
            <option value="latest_created">Latest created</option>
            <option value="most_bookings">Most bookings</option>
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchCustomers()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <span className="text-sm text-slate-500">
            {total} customer{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[880px] table-fixed text-sm">
          <colgroup>
            <col className="w-[5.5rem]" />
            <col className="w-[11rem]" />
            <col className="w-[12.5rem]" />
            <col className="w-[8.5rem]" />
            <col />
            <col className="w-[5.25rem]" />
            <col className="w-[6.75rem]" />
            <col className="w-[5.5rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Email</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Phone</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Vehicles</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bookings</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell whitespace-nowrap">Last booking</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                  {search || typeFilter !== 'all' ? 'No customers match your filters.' : 'No customers yet.'}
                </td>
              </tr>
            )}
            {!loading && customers.map((c) => (
              <tr key={c.customer_id ?? c.guest_key} className="group transition-colors hover:bg-slate-50/60">
                {/* Type */}
                <td className="px-3 py-2.5 align-middle">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                    c.type === 'account'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {c.type === 'account' ? 'Account' : 'Guest'}
                  </span>
                </td>

                {/* Name + ID */}
                <td className="px-3 py-2.5 align-middle min-w-0">
                  <p className="font-medium text-slate-900 truncate" title={c.name || undefined}>{c.name || '—'}</p>
                  {c.customer_id ? (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {c.customer_id}
                    </p>
                  ) : c.guest_key ? (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {'GUST_' + guestCode(c.guest_key)}
                    </p>
                  ) : null}
                </td>

                {/* Email */}
                <td className="px-3 py-2.5 text-slate-600 hidden md:table-cell align-middle min-w-0">
                  {c.email ? (
                    <span className="block truncate" title={c.email}>{c.email}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>

                {/* Phone */}
                <td className="px-3 py-2.5 text-slate-600 hidden sm:table-cell align-middle whitespace-nowrap">
                  {c.phone ? formatPhone(c.phone) : <span className="text-slate-300">—</span>}
                </td>

                {/* Vehicles */}
                <td className="px-3 py-2.5 hidden lg:table-cell align-middle min-w-0">
                  {c.vehicles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.vehicles.slice(0, 3).map((v) => (
                        <span key={v} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {v}
                        </span>
                      ))}
                      {c.vehicles.length > 3 && (
                        <span className="text-[11px] text-slate-400">+{c.vehicles.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-sm">—</span>
                  )}
                </td>

                {/* Booking count */}
                <td className="px-3 py-2.5 text-center align-middle whitespace-nowrap">
                  <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-indigo-50 px-2 text-[12px] font-bold text-indigo-700">
                    {c.total_booking_count}
                  </span>
                  {c.branch_booking_count > 0 && c.mobile_booking_count > 0 && (
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {c.branch_booking_count}B · {c.mobile_booking_count}M
                    </p>
                  )}
                </td>

                {/* Last booking */}
                <td className="px-3 py-2.5 text-[12px] text-slate-500 hidden lg:table-cell align-middle whitespace-nowrap tabular-nums">
                  {fmtDateTable(c.last_booking_date)}
                </td>

                {/* Action */}
                <td className="px-3 py-2.5 text-right align-middle whitespace-nowrap">
                  <button
                    onClick={() => setSelectedCustomer(c)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Booking history modal */}
      {selectedCustomer && (
        <BookingHistoryModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
