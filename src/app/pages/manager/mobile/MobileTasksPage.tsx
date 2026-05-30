import { useMemo, useState } from 'react';
import { useMobileManagerSession } from '../../../hooks/useMobileManagerSession';
import { useMobileServicesStore } from '../../../hooks/useMobileServicesStore';
import { getMobileOpsForPin, isValidPinCode, normalizePinCode } from '../../../lib/mobileServicesStore';
import {
  resolveBookingZipCode,
  isDriverBusyForWindow,
  isDriverServiceableForZip,
} from '../../../lib/mobileDriverEligibility';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export default function MobileTasksPage() {
  const { session } = useMobileManagerSession();
  const { state, staff, updateMobileOpsForPinAsync } = useMobileServicesStore();
  const pin = session?.cityPinCode ? normalizePinCode(session.cityPinCode) : '';
  const ops = useMemo(() => (pin ? getMobileOpsForPin(state, pin) : null), [state, pin]);
  const [selectedDriverByJob, setSelectedDriverByJob] = useState<Record<string, string>>({});

  const activeDrivers = useMemo(
    () => staff.filter((s) => normalizePinCode(s.cityPinCode) === pin && s.active),
    [staff, pin]
  );

  const tasks = useMemo(() => {
    if (!ops) return [];
    return [...ops.jobs]
      .filter((j) => j.status !== 'completed' && j.status !== 'cancelled')
      .sort((a, b) => `${a.slotDate}${a.startTime}`.localeCompare(`${b.slotDate}${b.startTime}`));
  }, [ops]);

  if (!session || !isValidPinCode(pin) || !ops) return null;

  const assign = async (jobId: string) => {
    const driverId = selectedDriverByJob[jobId];
    if (!driverId) return;
    const job = ops.jobs.find((j) => j.id === jobId);
    if (!job) return;
    try {
      await updateMobileOpsForPinAsync(pin, (prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.id === jobId ? { ...j, assignedStaffId: driverId, status: 'assigned' } : j
        ),
      }));
    } catch {
      window.alert('Failed to assign driver. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Task management</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            {tasks.length} active task{tasks.length === 1 ? '' : 's'} (unassigned + incoming bookings)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active tasks right now.</p>
          ) : (
            tasks.map((job) => {
              const bookingZip = resolveBookingZipCode(job);
              const availableDrivers = activeDrivers.filter(
                (d) =>
                  isDriverServiceableForZip(d, bookingZip, { strict: true }) &&
                  !isDriverBusyForWindow(ops.jobs, job.slotDate, job.startTime, job.endTime, d.id, job.id)
              );
              return (
                <div key={job.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="text-sm font-medium">
                    {job.customerName} - {job.slotDate} {job.startTime}-{job.endTime}
                  </div>
                  <div className="text-xs text-muted-foreground">{job.address || 'No address'}</div>
                  <div className="mt-2 flex gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={selectedDriverByJob[job.id] ?? ''}
                      onChange={(e) =>
                        setSelectedDriverByJob((prev) => ({ ...prev, [job.id]: e.target.value }))
                      }
                    >
                      <option value="">Select available driver</option>
                      {availableDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.empName || d.loginId}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={() => assign(job.id)}
                      disabled={!selectedDriverByJob[job.id]}
                    >
                      {job.assignedStaffId ? 'Reassign' : 'Assign'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
