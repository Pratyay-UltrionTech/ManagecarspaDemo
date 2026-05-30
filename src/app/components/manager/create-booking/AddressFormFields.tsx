/**
 * Structured address entry — mirrors User portal AddressDetailsFields.
 * Used in both Branch and Mobile Manager create-booking flows.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { cn } from '../../ui/utils';

const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

export type StructuredAddress = {
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
};

export const EMPTY_ADDRESS: StructuredAddress = {
  street_address: '',
  suburb: '',
  state: '',
  postcode: '',
};

export function composeAddress(a: StructuredAddress): string {
  const statePostcode = [a.state, a.postcode].filter(Boolean).join(' ');
  return [a.street_address, a.suburb, statePostcode].filter(Boolean).join(', ');
}

/** Parse a flat "street, suburb, STATE postcode" string back into structured fields. */
export function parseAddressString(raw: string): StructuredAddress {
  const s = raw.trim();
  if (!s) return EMPTY_ADDRESS;
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] ?? '';
  const tailMatch = tail.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b(?:\s+(\d{4,6}))?/i);
  const state = tailMatch?.[1]?.toUpperCase() ?? '';
  const postcode = (tailMatch?.[2] ?? '').replace(/\D/g, '').slice(0, 6);
  return {
    street_address: parts[0] ?? '',
    suburb: parts.length >= 3 ? (parts[1] ?? '') : '',
    state,
    postcode,
  };
}

export function validateAddress(a: StructuredAddress): Partial<Record<keyof StructuredAddress, string>> {
  return {
    street_address: a.street_address.trim() ? '' : 'Street address is required',
    suburb: a.suburb.trim() ? '' : 'Suburb is required',
    state: a.state ? '' : 'State is required',
    postcode: a.postcode.trim() ? '' : 'Postcode is required',
  };
}

export function isAddressComplete(a: StructuredAddress): boolean {
  const e = validateAddress(a);
  return !e.street_address && !e.suburb && !e.state && !e.postcode;
}

const field =
  'h-10 rounded-lg border-slate-200 bg-white shadow-sm transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:outline-none';

type Props = {
  value: StructuredAddress;
  onChange: (next: StructuredAddress) => void;
  errors?: Partial<Record<keyof StructuredAddress, string>>;
  /** When true the fields are optional — asterisks are hidden and no error messages shown. */
  optional?: boolean;
};

export function AddressFormFields({ value, onChange, errors, optional }: Props) {
  const fieldErrors = optional ? {} : (errors ?? {});
  return (
    <div className="grid gap-3">
      {/* Street address — full width */}
      <div className="grid gap-1.5">
        <Label htmlFor="af-street" className="text-sm font-medium">
          Street address {!optional && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id="af-street"
          className={cn(field, fieldErrors.street_address && 'border-destructive focus-visible:ring-destructive/25')}
          value={value.street_address}
          onChange={(e) => onChange({ ...value, street_address: e.target.value })}
          placeholder="e.g. 123 Main Street"
        />
        {fieldErrors.street_address && (
          <p className="text-xs text-destructive">{fieldErrors.street_address}</p>
        )}
      </div>

      {/* Suburb — full width */}
      <div className="grid gap-1.5">
        <Label htmlFor="af-suburb" className="text-sm font-medium">
          Suburb {!optional && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id="af-suburb"
          className={cn(field, fieldErrors.suburb && 'border-destructive focus-visible:ring-destructive/25')}
          value={value.suburb}
          onChange={(e) => onChange({ ...value, suburb: e.target.value })}
          placeholder="e.g. Parramatta"
        />
        {fieldErrors.suburb && (
          <p className="text-xs text-destructive">{fieldErrors.suburb}</p>
        )}
      </div>

      {/* State + Postcode side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="af-state" className="text-sm font-medium">
            State {!optional && <span className="text-destructive">*</span>}
          </Label>
          <Select value={value.state || undefined} onValueChange={(v) => onChange({ ...value, state: v })}>
            <SelectTrigger
              id="af-state"
              className={cn(field, 'h-10 w-full', fieldErrors.state && 'border-destructive focus-visible:ring-destructive/25')}
            >
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[200]">
              {AU_STATES.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.state && (
            <p className="text-xs text-destructive">{fieldErrors.state}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="af-postcode" className="text-sm font-medium">
            Postcode {!optional && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="af-postcode"
            className={cn(field, fieldErrors.postcode && 'border-destructive focus-visible:ring-destructive/25')}
            value={value.postcode}
            onChange={(e) =>
              onChange({ ...value, postcode: e.target.value.replace(/\D/g, '').slice(0, 6) })
            }
            placeholder="e.g. 2150"
            maxLength={6}
          />
          {fieldErrors.postcode && (
            <p className="text-xs text-destructive">{fieldErrors.postcode}</p>
          )}
        </div>
      </div>
    </div>
  );
}
