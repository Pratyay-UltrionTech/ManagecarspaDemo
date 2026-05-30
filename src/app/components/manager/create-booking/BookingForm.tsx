import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { cn } from '../../ui/utils';
import {
  AddressFormFields,
  type StructuredAddress,
} from './AddressFormFields';

export type SavedAddress = {
  id: string;
  label: string;
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
  is_default: boolean;
};

// Re-export so callers can import from one place.
export type { StructuredAddress };

const field =
  'h-10 rounded-lg border-slate-200 bg-white shadow-sm transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:outline-none';

export type BookingFormAssignee = { id: string; label: string };

type Props = {
  customerName: string;
  onCustomerNameChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  /** Structured address fields — replaces the old flat string address. */
  address: StructuredAddress;
  onAddressChange: (next: StructuredAddress) => void;
  addressErrors?: Partial<Record<keyof StructuredAddress, string>>;
  /** When true, address fields show no asterisks and no validation errors (branch bookings). */
  addressOptional?: boolean;
  vehicleType: string;
  onVehicleTypeChange: (v: string) => void;
  vehicleName?: string;
  onVehicleNameChange?: (v: string) => void;
  registrationNumber?: string;
  onRegistrationNumberChange?: (v: string) => void;
  vehicleTypes: string[];
  serviceOptions: { id: string; label: string }[];
  /** Selected catalog service id (empty = not chosen). */
  catalogServiceId: string;
  onCatalogServiceIdChange: (id: string) => void;
  serviceSummary: string;
  onServiceSummaryChange: (v: string) => void;
  assignees: BookingFormAssignee[];
  assigneeId: string;
  onAssigneeIdChange: (v: string) => void;
  assigneeLabel: string;
  /** Adds an "Unassigned" option with value `none` (mobile drivers). */
  allowUnassignedAssignee?: boolean;
  /** Hide washer/driver row (e.g. mobile picks driver on the slot calendar). */
  hideAssignee?: boolean;
  /** Omit notes row (e.g. mobile create booking renders notes after add-ons/tip). */
  hideNotes?: boolean;
  /** Hide vehicle type, name, and registration rows (used when a saved-vehicle picker drives those fields). */
  hideVehicleDetails?: boolean;
  /** Hide the phone field (caller renders it separately in a lookup section). */
  hidePhone?: boolean;
  /** Hide the email field (caller renders it separately in a lookup section). */
  hideEmail?: boolean;
  /** Hide the customer name field (caller renders it separately). */
  hideCustomerName?: boolean;
  /** Hide the service selector row (caller renders a rich service picker). */
  hideService?: boolean;
  savedAddresses?: SavedAddress[];
  notes?: string;
  onNotesChange?: (v: string) => void;
  formError: string;
};

export function BookingForm({
  customerName,
  onCustomerNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  address,
  onAddressChange,
  addressErrors,
  vehicleType,
  onVehicleTypeChange,
  vehicleName = '',
  onVehicleNameChange,
  registrationNumber = '',
  onRegistrationNumberChange,
  vehicleTypes,
  serviceOptions,
  catalogServiceId,
  onCatalogServiceIdChange,
  serviceSummary,
  onServiceSummaryChange,
  assignees,
  assigneeId,
  onAssigneeIdChange,
  assigneeLabel,
  allowUnassignedAssignee = false,
  hideAssignee = false,
  hideNotes = false,
  hideVehicleDetails = false,
  hidePhone = false,
  hideEmail = false,
  hideCustomerName = false,
  hideService = false,
  addressOptional = false,
  savedAddresses = [],
  notes = '',
  onNotesChange = () => {},
  formError,
}: Props) {
  const assigneeSelectDisabled = assignees.length === 0 && !allowUnassignedAssignee;

  return (
    <div className="space-y-6">
      <div className="grid gap-5">
        {/* Phone + Customer name row — hidden when caller renders phone separately */}
        {!hidePhone && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cb-phone">Phone *</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-xs font-medium">
                  +61
                </span>
                <Input
                  id="cb-phone"
                  className={cn(field, 'rounded-l-none')}
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    onPhoneChange(val.slice(0, 9));
                  }}
                  placeholder="4XXXXXXXX"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cb-name">Customer name *</Label>
              <Input
                id="cb-name"
                className={field}
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Customer name standalone row — only when phone row is hidden and name not hidden */}
        {hidePhone && !hideCustomerName && (
          <div className="grid gap-2">
            <Label htmlFor="cb-name">Customer name *</Label>
            <Input
              id="cb-name"
              className={field}
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
            />
          </div>
        )}

        {/* Email + Vehicle type row — skip entirely when both hidden */}
        {(!hideEmail || !hideVehicleDetails) && <div className="grid gap-4 sm:grid-cols-2">
          {!hideEmail && (
            <div className="grid gap-2">
              <Label htmlFor="cb-email">Email *</Label>
              <Input
                id="cb-email"
                type="email"
                className={field}
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
          )}
          {!hideVehicleDetails && (
            <div className="grid gap-2">
              <Label htmlFor="cb-vehicle">Vehicle type</Label>
              {vehicleTypes.length > 0 ? (
                <Select value={vehicleType} onValueChange={onVehicleTypeChange}>
                  <SelectTrigger id="cb-vehicle" className={cn(field, 'h-10 w-full')}>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[100]">
                    {vehicleTypes.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="cb-vehicle"
                  className={field}
                  value={vehicleType}
                  onChange={(e) => onVehicleTypeChange(e.target.value)}
                  placeholder="e.g. SUV"
                />
              )}
            </div>
          )}
        </div>}

        {!hideVehicleDetails && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cb-vehicle-name">Vehicle name</Label>
              <Input
                id="cb-vehicle-name"
                className={field}
                value={vehicleName}
                onChange={(e) => onVehicleNameChange?.(e.target.value)}
                placeholder="e.g. Toyota Corolla"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cb-reg">Registration number</Label>
              <Input
                id="cb-reg"
                className={field}
                value={registrationNumber}
                onChange={(e) => onRegistrationNumberChange?.(e.target.value)}
                placeholder="e.g. ABC 123"
              />
            </div>
          </div>
        )}

        {/* ── Address section ─────────────────────────────────── */}
        <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3">
          <p className="text-sm font-semibold text-foreground">
            Customer address{addressOptional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>}
          </p>

          {savedAddresses.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="cb-saved-address" className="text-xs text-muted-foreground">
                Saved addresses
              </Label>
              <Select
                onValueChange={(id) => {
                  const a = savedAddresses.find((x) => x.id === id);
                  if (!a) return;
                  onAddressChange({
                    street_address: a.street_address,
                    suburb: a.suburb,
                    state: a.state,
                    postcode: a.postcode,
                  });
                }}
              >
                <SelectTrigger id="cb-saved-address" className={cn(field, 'h-9 w-full bg-white')}>
                  <SelectValue placeholder="Select a saved address to auto-fill…" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {savedAddresses.map((a) => {
                    const parts = [a.street_address, a.suburb, a.state, a.postcode].filter(Boolean);
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-medium">{a.label}</span>
                        {parts.length > 0 && (
                          <span className="ml-1.5 text-muted-foreground">— {parts.join(', ')}</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <AddressFormFields
            value={address}
            onChange={onAddressChange}
            errors={addressErrors}
            optional={addressOptional}
          />
        </div>

        {hideService ? null : (
          <div className="grid gap-2">
            <Label htmlFor="cb-service">Service *</Label>
            <Select
              value={catalogServiceId || undefined}
              onValueChange={(id) => {
                onCatalogServiceIdChange(id);
                const row = serviceOptions.find((s) => s.id === id);
                onServiceSummaryChange(row?.label ?? '');
              }}
              disabled={serviceOptions.length === 0}
            >
              <SelectTrigger id="cb-service" className={cn(field, 'h-10 w-full')}>
                <SelectValue placeholder={serviceOptions.length ? 'Select service' : 'No services in catalog'} />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[100]">
                {serviceOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hideAssignee ? null : (
          <div className="grid gap-2">
            <Label htmlFor="cb-assignee">{assigneeLabel} *</Label>
            <Select value={assigneeId} onValueChange={onAssigneeIdChange} disabled={assigneeSelectDisabled}>
              <SelectTrigger id="cb-assignee" className={cn(field, 'h-10 w-full')}>
                <SelectValue
                  placeholder={
                    allowUnassignedAssignee
                      ? 'Optional'
                      : assignees.length
                        ? `Select ${assigneeLabel.toLowerCase()}`
                        : `No active ${assigneeLabel.toLowerCase()}`
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[100]">
                {allowUnassignedAssignee ? (
                  <SelectItem value="none">Unassigned</SelectItem>
                ) : null}
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hideNotes ? null : (
          <div className="grid gap-2">
            <Label htmlFor="cb-notes">Notes</Label>
            <Input id="cb-notes" className={field} value={notes} onChange={(e) => onNotesChange(e.target.value)} />
          </div>
        )}
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
    </div>
  );
}
