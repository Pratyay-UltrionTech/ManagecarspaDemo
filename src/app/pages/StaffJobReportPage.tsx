import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  CheckCircle2,
  Users,
  HandCoins,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { SegmentedPillTabs } from '../components/SegmentedPillTabs';
import { API_BASE } from '../lib/apiBase';
import { useAdminSession } from '../hooks/useAdminSession';
import { cn } from '../components/ui/utils';

// ── types ────────────────────────────────────────────────────────────────────

interface StaffBar {
  staff_id: string;
  name: string;
  completed: number;
  tips: number;
  staff_type: 'branch' | 'mobile';
}

interface StaffJobData {
  total_completed: number;
  avg_per_staff: number;
  total_tips: number;
  staff_count: number;
  date_from: string;
  date_to: string;
  staff_type: string;
  chart: StaffBar[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 2,
  }).format(val);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Truncate long names for axis ticks
function shortName(name: string, max = 14): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

// Bar colours — cycle through palette
const BAR_COLOURS = [
  '#6366f1', '#10b981', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899',
];

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
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
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function StaffJobReportPage() {
  const { session } = useAdminSession();

  const [dateFrom, setDateFrom] = useState(firstOfMonthIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [staffType, setStaffType] = useState('all');

  const [data, setData] = useState<StaffJobData | null>(null);
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
        staff_type: staffType,
      });
      const res = await fetch(`${API_BASE}/admin/reports/staff-jobs?${params}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Server error ${res.status}`);
      }
      const json = (await res.json()) as StaffJobData;
      setData(json);
      setHasLoaded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, dateFrom, dateTo, staffType]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const bar = data?.chart.find((b) => b.name === label);
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs min-w-[160px]">
        <p className="mb-2 font-semibold text-slate-700 truncate max-w-[180px]">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span style={{ color: p.color }} className="font-medium">{p.name}</span>
            <span className="font-semibold text-slate-800">{p.value}</span>
          </div>
        ))}
        {bar && (
          <div className="mt-1.5 border-t border-slate-100 pt-1.5 flex items-center justify-between gap-4">
            <span className="text-slate-400">Tips</span>
            <span className="font-semibold text-slate-700">{fmt(bar.tips)}</span>
          </div>
        )}
        {bar && (
          <p className="mt-0.5 text-slate-400 capitalize">
            {bar.staff_type === 'branch' ? 'Branch Washer' : 'Mobile Driver'}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Washer &amp; Driver Job Completion
        </h1>
        <p className="text-sm text-slate-500">
          Track completed jobs, per-staff averages and tips earned by branch washers and mobile drivers.
        </p>
      </div>

      {/* ── Filters card ── */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-slate-800">Filters</CardTitle>
          <CardDescription className="text-xs">
            Select the date range and staff type, then click Run Report.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="grid gap-5 sm:grid-cols-3">

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

            {/* Staff type */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Staff Type</Label>
              <SegmentedPillTabs
                value={staffType}
                onValueChange={setStaffType}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'branch', label: 'Branch' },
                  { value: 'mobile', label: 'Mobile' },
                ]}
              />
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
                {data?.date_from} → {data?.date_to}
                {data?.staff_count != null && ` · ${data.staff_count} staff member${data.staff_count !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI cards ── */}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              title="Total Jobs Completed"
              value={data.total_completed.toLocaleString()}
              sub={`Across ${data.staff_count} staff member${data.staff_count !== 1 ? 's' : ''}`}
              icon={CheckCircle2}
              accent="text-emerald-600"
              bg="bg-emerald-50"
            />
            <KpiCard
              title="Avg Jobs Per Staff"
              value={data.avg_per_staff.toFixed(1)}
              sub="Completed jobs ÷ active staff"
              icon={Users}
              accent="text-indigo-600"
              bg="bg-indigo-50"
            />
            <KpiCard
              title="Total Tips Earned"
              value={fmt(data.total_tips)}
              sub="From completed bookings"
              icon={HandCoins}
              accent="text-amber-600"
              bg="bg-amber-50"
            />
          </div>

          {/* ── Bar chart (per staff) ── */}
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-medium">Jobs Completed per Staff Member</CardTitle>
              <CardDescription className="text-xs">
                Sorted by number of completed jobs (highest first) for the selected period.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {data.chart.length === 0 || data.total_completed === 0 ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
                  <p className="text-sm text-slate-400">No completed jobs found for this period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={data.chart}
                    margin={{ top: 8, right: 16, left: 0, bottom: 80 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      angle={-40}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="completed" name="Completed Jobs" radius={[3, 3, 0, 0]}>
                      {data.chart.map((entry, index) => (
                        <Cell
                          key={entry.staff_id}
                          fill={BAR_COLOURS[index % BAR_COLOURS.length]}
                        />
                      ))}
                    </Bar>
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
            <p className="text-sm font-medium text-slate-500">
              Set your filters and click <strong>Run Report</strong>
            </p>
            <p className="mt-1 text-xs text-slate-400">Staff job data will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}
