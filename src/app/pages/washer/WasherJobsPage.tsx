import { useEffect, useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useWasherSession } from '../../hooks/useWasherSession';
import { apiPatchWasherJob, apiWasherJobs } from '../../lib/apiClient';

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

type Job = {
  id: string;
  slot_date: string;
  created_at: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  address: string;
  phone: string;
  vehicle_type: string;
  service_summary: string;
  status: string;
  notes: string;
  tip_cents: number;
};

function normalizeJob(raw: any): Job {
  return {
    id: String(raw.id ?? ''),
    slot_date: String(raw.slot_date ?? raw.slotDate ?? ''),
    start_time: String(raw.start_time ?? raw.startTime ?? ''),
    end_time: String(raw.end_time ?? raw.endTime ?? ''),
    customer_name: String(raw.customer_name ?? raw.customerName ?? ''),
    address: String(raw.address ?? ''),
    phone: String(raw.phone ?? ''),
    vehicle_type: String(raw.vehicle_type ?? raw.vehicleType ?? ''),
    service_summary: String(raw.service_summary ?? raw.serviceSummary ?? ''),
    status: String(raw.status ?? 'scheduled'),
    notes: String(raw.notes ?? ''),
    tip_cents: Number(raw.tip_cents ?? raw.tipCents ?? 0) || 0,
    created_at: String(raw.created_at ?? ''),
  };
}

export default function WasherJobsPage() {
  const { session } = useWasherSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const rows = await apiWasherJobs(session.accessToken);
      setJobs(rows.map(normalizeJob));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs.');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => { void load(); }, 20000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [session?.accessToken]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, Job[]>();
    for (const j of jobs) {
      const k = j.slot_date || 'Unknown date';
      const arr = byDate.get(k) ?? [];
      arr.push(j);
      byDate.set(k, arr);
    }
    return Array.from(byDate.entries()).sort((a, b) => {
      const maxA = a[1].reduce((m, j) => (j.created_at > m ? j.created_at : m), '');
      const maxB = b[1].reduce((m, j) => (j.created_at > m ? j.created_at : m), '');
      return maxB.localeCompare(maxA);
    });
  }, [jobs]);

  const setStatus = async (jobId: string, status: string) => {
    if (!session) return;
    setSavingId(jobId);
    try {
      await apiPatchWasherJob(session.accessToken, jobId, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">My jobs</h1>
        <Button type="button" variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assigned jobs yet.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, list]) => (
            <Card key={date} className="overflow-hidden border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-slate-50/40">
                <CardTitle className="text-base font-semibold">{date}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100 p-0">
                {list
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((j) => {
                    const isFinal = j.status === 'completed' || j.status === 'cancelled';
                    return (
                    <div key={j.id} className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {j.start_time} – {j.end_time} · {j.vehicle_type}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{j.service_summary}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {j.customer_name} · {formatPhone(j.phone)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{j.address || '—'}</p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status: <span className="capitalize">{j.status.replace(/_/g, ' ')}</span>
                          </p>
                          {j.tip_cents > 0 ? (
                            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
                              <HandCoins className="size-4 shrink-0" aria-hidden />
                              Customer tip: ${(j.tip_cents / 100).toFixed(2)}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={savingId === j.id || isFinal}
                            onClick={() => setStatus(j.id, 'checked_in')}
                          >
                            Check-in
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={savingId === j.id || isFinal}
                            onClick={() => setStatus(j.id, 'in_progress')}
                          >
                            Start
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingId === j.id || isFinal}
                            onClick={() => setStatus(j.id, 'completed')}
                          >
                            Complete
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={savingId === j.id || isFinal}
                            onClick={() => setStatus(j.id, 'cancelled')}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

