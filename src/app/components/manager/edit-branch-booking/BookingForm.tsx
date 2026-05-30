import type { AddonItem } from '../../../lib/catalogShapeTypes';
import type { BranchBookingJob, Washer } from '../../../lib/branchStore';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { cn } from '../../ui/utils';

/** A single labelled detail row — label above, value below. */
function DetailRow({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={cn('grid gap-0.5', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 leading-snug break-words">
        {value?.trim() || <span className="text-slate-400 font-normal">—</span>}
      </p>
    </div>
  );
}

type Props = {
  model: BranchBookingJob;
  onPatch: (patch: Partial<BranchBookingJob>) => void;
  washersForSelect: Washer[];
  addonChoices: AddonItem[];
  /** When true, ring the washer select amber to draw attention. */
  highlightWasher?: boolean;
  /** When true, washer cannot be changed (e.g. work in progress). */
  lockWasherAssign?: boolean;
};

export function BookingForm({
  model,
  onPatch,
  washersForSelect,
  addonChoices,
  highlightWasher = false,
  lockWasherAssign = false,
}: Props) {
  const field =
    'h-10 rounded-lg border-slate-200 bg-white shadow-sm transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:outline-none';

  const selectedAddons = addonChoices.filter((a) => (model.selectedAddonIds ?? []).includes(a.id));

  return (
    <div className="grid gap-6">

      {/* ── Customer ── */}
      <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Name" value={model.customerName} />
          <DetailRow label="Phone" value={(() => {
            const raw = model.phone;
            if (!raw) return null;
            const s = raw.trim();
            if (!s) return null;
            if (s.startsWith('+')) return s.replace(/^\+61(\d)/, '+61-$1');
            const digits = s.replace(/\D/g, '');
            if (digits.length === 10 && digits.startsWith('0')) return `+61-${digits.slice(1)}`;
            if (digits.length === 9) return `+61-${digits}`;
            return s;
          })()} />
        </div>
        {model.address ? <DetailRow label="Address" value={model.address} /> : null}
      </section>

      {/* ── Vehicle ── */}
      <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Vehicle</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Vehicle type" value={model.vehicleType} />
          <DetailRow label="Vehicle name" value={model.vehicleName} />
          <DetailRow label="Registration number" value={model.registrationNumber} />
        </div>
      </section>

      {/* ── Service ── */}
      <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Service</p>
        <DetailRow label="Service" value={model.serviceSummary?.split('+')[0]?.trim() ?? model.serviceSummary} />
        {selectedAddons.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Add-ons</p>
            <div className="grid gap-0.5">
              {selectedAddons.map((a) => (
                <p key={a.id} className="text-sm font-medium text-slate-800 leading-snug">
                  {a.name}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {model.notes ? <DetailRow label="Notes" value={model.notes} /> : null}
      </section>

      {/* ── Washer assignment (editable) ── */}
      <section className="grid gap-3 rounded-xl border border-slate-200/70 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {lockWasherAssign ? 'Assigned washer' : 'Assign washer'}
        </p>
        <div className="grid gap-2">
          {highlightWasher && !model.assignedWasherId && !lockWasherAssign && (
            <p className="text-xs font-semibold text-amber-700">Washer is required</p>
          )}
          {washersForSelect.length === 0 && !lockWasherAssign ? (
            <p className="text-sm text-muted-foreground">No active washers available for this slot.</p>
          ) : lockWasherAssign ? (
            <p className="text-sm font-medium text-slate-800 leading-snug break-words">
              {washersForSelect.find((w) => w.id === model.assignedWasherId)?.name ||
                washersForSelect.find((w) => w.id === model.assignedWasherId)?.loginId ||
                model.assignedWasherId ||
                '—'}
            </p>
          ) : (
            <Select
              value={model.assignedWasherId ?? 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  onPatch({ assignedWasherId: null });
                } else {
                  onPatch({
                    assignedWasherId: v,
                    ...(model.status === 'scheduled' ? { status: 'assigned' } : {}),
                  });
                }
              }}
            >
              <SelectTrigger
                id="ebm-washer"
                className={cn(
                  field,
                  'w-full',
                  highlightWasher && !model.assignedWasherId
                    ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/50'
                    : '',
                )}
              >
                <SelectValue placeholder="Select a washer" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[120] max-h-72">
                <SelectItem value="none">Select a washer</SelectItem>
                {washersForSelect.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name || w.loginId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </section>

    </div>
  );
}
