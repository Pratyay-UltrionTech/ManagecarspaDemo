import { useMemo, useState } from 'react';
import { useBranchStore } from '../../hooks/useBranchStore';
import { useManagerSession } from '../../hooks/useManagerSession';
import { generateOperatingDaySlots, normalizeSlotDurationMinutes } from '../../lib/branchSlotSchedule';
import { todayLocalISO } from '../../lib/managerPortalUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfigureSlotsCalendar } from '../../components/manager/ConfigureSlotsCalendar';
import { cn } from '../../components/ui/utils';

const cardSurface =
  'rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]';

export default function ConfigureSlotsPage() {
  const { session } = useManagerSession();
  const { branches, getData, updateBranchData } = useBranchStore();
  const branchId = session?.branchId ?? '';
  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const [previewDate, setPreviewDate] = useState(todayLocalISO());

  const duration = normalizeSlotDurationMinutes(data?.managerSlotDurationMinutes ?? 60);
  const previewSlots = useMemo(() => {
    if (!branch) return [];
    return generateOperatingDaySlots(branch.openTime, branch.closeTime, branch.bayCount, duration);
  }, [branch, duration]);

  if (!session || !branch || !data) return null;

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Configure bay</h1>
      </header>

      <Card className={cn(cardSurface, 'overflow-hidden')}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 pb-4 pt-5">
          <CardTitle className="text-base font-semibold">Branch schedule (from admin)</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Hours {branch.openTime} – {branch.closeTime} · {branch.bayCount} bay
            {branch.bayCount === 1 ? '' : 's'} · {duration}-minute slots.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200/80 bg-gradient-to-br from-white to-indigo-50/50 px-4 py-3 text-center shadow-sm sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bays</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">{branch.bayCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-gradient-to-br from-white to-indigo-50/50 px-4 py-3 text-center shadow-sm sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{branch.openTime}</p>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-gradient-to-br from-white to-indigo-50/50 px-4 py-3 text-center shadow-sm sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Close</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{branch.closeTime}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cn(cardSurface, 'overflow-hidden')}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-6 pb-5 pt-6">
          <CardTitle className="text-base font-semibold">Calendar & availability</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 overflow-x-hidden px-6 py-6">
          {previewSlots.length === 0 ? (
            <p className="text-sm text-amber-800">
              No slots fit between open and close. Ask admin to widen branch hours.
            </p>
          ) : (
            <div className="min-w-0 max-w-full">
              <ConfigureSlotsCalendar
                branchId={branchId}
                branch={branch}
                data={data}
                previewSlots={previewSlots}
                previewDate={previewDate}
                onPreviewDateChange={setPreviewDate}
                updateBranchData={updateBranchData}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
