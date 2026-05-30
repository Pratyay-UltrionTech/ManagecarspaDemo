import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import {
  managerListLeaveRequests,
  managerUpdateLeaveRequestStatus,
  type ManagerLeaveRequest,
} from '../../lib/leaveApi';
import { useManagerSession } from '../../hooks/useManagerSession';
import { Button } from '../../components/ui/button';
import { cn } from '../../components/ui/utils';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
} as const;

const cardSurface =
  'rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function WasherLeaveRequestsPage() {
  const { session } = useManagerSession();
  const [requests, setRequests] = useState<ManagerLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionPending, setActionPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await managerListLeaveRequests();
      setRequests(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leave requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    setActionPending((prev) => ({ ...prev, [id]: true }));
    try {
      const updated = await managerUpdateLeaveRequestStatus(id, status);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionPending((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const filtered = (filterStatus === 'all' ? requests : requests.filter((r) => r.status === filterStatus))
    .slice()
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (!session) return null;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Washer leave requests
          </h1>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-700">
              {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting review
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 self-start sm:self-auto"
          disabled={refreshing || loading}
          onClick={() => void load(true)}
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((s) => {
          const count = s === 'all' ? requests.length : requests.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filterStatus === s
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardSurface, 'px-6 py-16 text-center')}>
          <CheckCircle className="mx-auto mb-3 size-10 text-slate-300" />
          <p className="font-medium text-slate-500">
            {filterStatus === 'all' ? 'No leave requests yet' : `No ${filterStatus} requests`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Leave requests submitted by your washers will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const busy = Boolean(actionPending[req.id]);

            return (
              <div
                key={req.id}
                className={cn(
                  cardSurface,
                  'px-5 py-4',
                  req.status === 'pending' && 'border-amber-200/60 bg-amber-50/30'
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: washer info + leave details */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {req.washer_name || 'Washer'}
                      </p>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          cfg.className
                        )}
                      >
                        <StatusIcon className="size-3" strokeWidth={2.5} />
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground">Date:</span>{' '}
                        {req.leave_date}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">Type:</span>{' '}
                        {req.leave_type === 'full_day' ? 'Full Day' : 'Partial Day'}
                        {req.leave_type === 'partial_day' && req.start_time && req.end_time
                          ? ` · ${req.start_time} – ${req.end_time}`
                          : ''}
                      </span>
                      {req.created_at && (
                        <span>
                          <span className="font-medium text-foreground">Submitted:</span>{' '}
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {req.reason && (
                      <p className="text-xs italic text-muted-foreground">
                        Reason: &ldquo;{req.reason}&rdquo;
                      </p>
                    )}

                    {req.status !== 'pending' && req.reviewed_at && (
                      <p className="text-[11px] text-muted-foreground">
                        {req.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
                        {new Date(req.reviewed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Right: action buttons (only for pending) */}
                  {req.status === 'pending' && (
                    <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        className="h-8 gap-1.5 bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
                        onClick={() => void handleAction(req.id, 'approved')}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="size-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="h-8 gap-1.5 border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => void handleAction(req.id, 'rejected')}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <XCircle className="size-3.5" />
                        )}
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
