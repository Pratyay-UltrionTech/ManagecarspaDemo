import { format, parse } from 'date-fns';

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-0.5 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 leading-snug break-words">
        {value?.trim() || <span className="text-slate-400 font-normal">—</span>}
      </p>
    </div>
  );
}

function formatPhoneDisplay(phone?: string | null): string | null {
  const raw = phone;
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('+')) return s.replace(/^\+61(\d)/, '+61-$1');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+61-${digits.slice(1)}`;
  if (digits.length === 9) return `+61-${digits}`;
  return s;
}

function formatServiceDateTime(slotDate: string, startTime: string, endTime: string): string {
  if (!slotDate?.trim()) return '—';
  try {
    const d = parse(slotDate.trim(), 'yyyy-MM-dd', new Date());
    const datePart = format(d, 'd MMM yyyy');
    const st = (startTime || '').trim();
    const et = (endTime || '').trim();
    if (st && et) return `${datePart} · ${st}–${et}`;
    if (st) return `${datePart} · ${st}`;
    return datePart;
  } catch {
    return [slotDate, startTime, endTime].filter(Boolean).join(' ');
  }
}

export type InProgressBookingDetailsPanelProps = {
  customerName: string;
  address?: string | null;
  phone?: string | null;
  vehicleType?: string | null;
  vehicleName?: string | null;
  registrationNumber?: string | null;
  service: string;
  addonNames: string[];
  slotDate: string;
  startTime: string;
  endTime: string;
  assigneeLabel: 'Driver name' | 'Washer name';
  assigneeName: string;
  /** Branch bookings only — shown on the right above washer name. */
  bayNumber?: number | null;
};

/** Read-only two-column layout for in-progress manage booking (branch + mobile). */
export function InProgressBookingDetailsPanel({
  customerName,
  address,
  phone,
  vehicleType,
  vehicleName,
  registrationNumber,
  service,
  addonNames,
  slotDate,
  startTime,
  endTime,
  assigneeLabel,
  assigneeName,
  bayNumber,
}: InProgressBookingDetailsPanelProps) {
  const addonsText = addonNames.length > 0 ? addonNames.join(', ') : '—';
  const dateTime = formatServiceDateTime(slotDate, startTime, endTime);
  const reg = registrationNumber?.trim().toUpperCase() || null;

  return (
    <section className="w-full rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Booking details</p>
      <div className="mt-2 grid grid-cols-2 items-start gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-2">
          <DetailRow label="Name" value={customerName} />
          <DetailRow label="Address" value={address} />
          <DetailRow label="Phone no." value={formatPhoneDisplay(phone)} />
          <DetailRow label="Vehicle type" value={vehicleType} />
          <DetailRow label="Vehicle name" value={vehicleName} />
          <DetailRow label="Registration no." value={reg} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <DetailRow label="Service" value={service} />
          <DetailRow label="Add-ons" value={addonsText} />
          <DetailRow label="Service date & time" value={dateTime} />
          {bayNumber != null ? <DetailRow label="Bay" value={`Bay ${bayNumber}`} /> : null}
          <DetailRow label={assigneeLabel} value={assigneeName} />
        </div>
      </div>
    </section>
  );
}
