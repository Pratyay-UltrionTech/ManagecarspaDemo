import { useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  BarChart2,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { SegmentedPillTabs } from '../components/SegmentedPillTabs';
import { API_BASE } from '../lib/apiBase';
import { useAdminSession } from '../hooks/useAdminSession';
import { cn } from '../components/ui/utils';

// ── types ────────────────────────────────────────────────────────────────────

interface ChartBucket {
  label: string;
  total: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
  in_progress: number;
}

interface BookingDetailData {
  total: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
  in_progress: number;
  date_from: string;
  date_to: string;
  channel: string;
  customer_type: string;
  service_type: string;
  chart: ChartBucket[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function shortLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  bg: string;
}

function KpiCard({ title, value, sub, icon: Icon, accent, bg }: KpiCardProps) {
  return (
    <Card className="border-slate-200/60 shadow-sm">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5', bg)}>
          <Icon className={cn('size-5', accent)} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{value.toLocaleString()}</p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function BookingReportPage() {
  const { session } = useAdminSession();

  const [dateFrom, setDateFrom] = useState(firstOfMonthIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [channel, setChannel] = useState('all');
  const [customerType, setCustomerType] = useState('all');

  const [data, setData] = useState<BookingDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session?.accessToken) return;
    if (!dateFrom || !dateTo) {
      setError('Please select both a start date and an end date.');
      return;
    }
    if (dateFrom > dateTo) {
      setError('Start date must be on or before end date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        channel,
        customer_type: customerType,
      });
      const res = await fetch(`${API_BASE}/admin/reports/booking-detail?${params}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Server error ${res.status}`);
      }
      const json = (await res.json()) as BookingDetailData;
      setData(json);
      setHasLoaded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, dateFrom, dateTo, channel, customerType]);

  // Custom Recharts tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs">
        <p className="mb-2 font-semibold text-slate-700">{shortLabel(label)}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span style={{ color: p.color }} className="font-medium">{p.name}</span>
            <span className="font-semibold text-slate-800">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Booking Summary</h1>
        <p className="text-sm text-slate-500">
          Analyse total bookings, completions, cancellations and reschedules across any date range.
        </p>
      </div>

      {/* ── Filters card ── */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-slate-800">Filters</CardTitle>
          <CardDescription className="text-xs">Select the date range and filters, then click Run Report.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

            {/* Date from */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">From</Label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || todayIso()}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Date to */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">To</Label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Channel */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Channel</Label>
              <SegmentedPillTabs
                value={channel}
                onValueChange={setChannel}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'branch', label: 'Branch' },
                  { value: 'mobile', label: 'Mobile' },
                ]}
              />
            </div>

            {/* Customer type */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer Type</Label>
              <Select value={customerType} onValueChange={setCustomerType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="account">Member</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-500">{error}</p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={fetchData} disabled={loading} className="gap-2">
              {loading ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <BarChart2 className="size-3.5" />
              )}
              {loading ? 'Loading…' : 'Run Report'}
            </Button>
            {hasLoaded && !loading && (
              <span className="text-[11px] text-slate-400">
                Showing {data?.date_from} → {data?.date_to}
                {data?.total != null && ` · ${data.total} booking${data.total !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI cards ── */}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Bookings"
              value={data.total}
              sub="All statuses in range"
              icon={CalendarDays}
              accent="text-indigo-600"
              bg="bg-indigo-50"
            />
            <KpiCard
              title="Completed"
              value={data.completed}
              sub={data.total > 0 ? `${Math.round((data.completed / data.total) * 100)}% of total` : undefined}
              icon={CheckCircle2}
              accent="text-emerald-600"
              bg="bg-emerald-50"
            />
            <KpiCard
              title="Cancelled"
              value={data.cancelled}
              sub={data.total > 0 ? `${Math.round((data.cancelled / data.total) * 100)}% of total` : undefined}
              icon={XCircle}
              accent="text-rose-500"
              bg="bg-rose-50"
            />
            <KpiCard
              title="In Progress"
              value={data.in_progress ?? 0}
              sub={data.total > 0 ? `${Math.round(((data.in_progress ?? 0) / data.total) * 100)}% of total` : undefined}
              icon={Clock}
              accent="text-amber-500"
              bg="bg-amber-50"
            />
          </div>

          {/* ── Bar chart ── */}
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-medium">Bookings Over Time</CardTitle>
              <CardDescription className="text-xs">
                {data.chart.length > 60
                  ? 'Grouped by week (range exceeds 60 days)'
                  : 'Daily breakdown for the selected period'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {data.chart.length === 0 || data.total === 0 ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
                  <p className="text-sm text-slate-400">No bookings found for this period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={data.chart}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                    barCategoryGap="30%"
                    barGap={3}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickFormatter={shortLabel}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="total" name="Total" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cancelled" name="Cancelled" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="in_progress" name="In Progress" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty / pre-load state */}
      {!data && !loading && (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
          <div className="text-center">
            <BarChart2 className="mx-auto mb-3 size-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Set your filters and click <strong>Run Report</strong></p>
            <p className="mt-1 text-xs text-slate-400">Booking data will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}
