import { useMemo, useState, useEffect } from 'react';
import { useBranchStore } from '../../hooks/useBranchStore';
import { useManagerSession } from '../../hooks/useManagerSession';
import {
  branchStoreApi,
  findBookingForBayWindow,
  findCatalogServiceById,
  listServiceOptionsForVehicle,
  listVehicleTypes,
  washerIdsBusyInSlot,
  type BranchBookingJob,
  type BranchData,
} from '../../lib/branchStore';
import type { AddonItem, ServiceItem } from '../../lib/catalogShapeTypes';
import {
  branchBookingEndHHMM,
  generateOperatingDaySlots,
  getEffectiveSlotState,
  normalizeSlotDurationMinutes,
  parseTimeToMinutes,
  slotWindowKey,
  totalMinutesForServiceAndAddons,
} from '../../lib/branchSlotSchedule';
import { scheduleSliceFromBranchData } from '../../lib/configureSlotReschedule';
import { todayLocalISO, currentHHMM } from '../../lib/managerPortalUtils';
import { branchCheckoutTotalCents } from '../../lib/managerCheckoutPricing';
import { CalendarPopover } from '../../components/manager/edit-branch-booking/CalendarPopover';
import { SlotSelector } from '../../components/manager/edit-branch-booking/SlotSelector';
import { BookingForm } from '../../components/manager/create-booking/BookingForm';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { cn } from '../../components/ui/utils';
import { PaymentSelector, type PaymentMethod } from '../../components/manager/PaymentSelector';
import { Loader2 } from 'lucide-react';
import { createBranchManagerBooking, managerLookupCustomer } from '../../lib/branchApi';
import type { SavedAddress, StructuredAddress } from '../../components/manager/create-booking/BookingForm';
import {
  composeAddress,
  parseAddressString,
  validateAddress,
  EMPTY_ADDRESS,
} from '../../components/manager/create-booking/AddressFormFields';

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]';

function branchAddonChoices(data: BranchData): AddonItem[] {
  if (data.branchAddons?.length) return data.branchAddons.filter((a) => a.active !== false);
  return Array.from(
    new Map(data.vehicleServices.flatMap((v) => v.addons ?? []).map((a) => [a.id, a])).values()
  ).filter((a) => a.active !== false);
}

export default function CreateBookingPage() {
  const { session } = useManagerSession();
  const { branches, getData, updateBranchData, refresh } = useBranchStore();
  const branchId = session?.branchId ?? '';
  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState<StructuredAddress>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof StructuredAddress, string>>>({});
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isGuestCustomer, setIsGuestCustomer] = useState(false);
  type LookupStatus = 'idle' | 'loading' | 'existing' | 'guest' | 'new';
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [customerVehicles, setCustomerVehicles] = useState<{ type?: string; name?: string; registration?: string }[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [catalogServiceId, setCatalogServiceId] = useState('');
  const [serviceSummary, setServiceSummary] = useState('');
  const [slotDate, setSlotDate] = useState(todayLocalISO());
  const [washerId, setWasherId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [tipDollars, setTipDollars] = useState('');
  const [pickedBaySlot, setPickedBaySlot] = useState<{
    startTime: string;
    endTime: string;
    bayNumber: number;
  } | null>(null);
  const [formError, setFormError] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<BranchBookingJob | null>(null);
  const [lastPaymentMethod, setLastPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('pay_after');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  const tipCents = Math.min(50_000, Math.max(0, Math.round((parseFloat(tipDollars) || 0) * 100)));

  const vehicleTypes = useMemo(() => (data ? listVehicleTypes(data) : []), [data]);
  const serviceOptions = useMemo(
    () => (data && vehicleType ? listServiceOptionsForVehicle(data, vehicleType) : []),
    [data, vehicleType]
  );
  const fullServiceItems = useMemo<ServiceItem[]>(() => {
    if (!data || !vehicleType) return [];
    const vb = data.vehicleServices.find((v) => v.vehicleType === vehicleType);
    return (vb?.services ?? []).filter((s) => s.active !== false);
  }, [data, vehicleType]);
  const addonChoices = useMemo(() => (data ? branchAddonChoices(data) : []), [data]);

  const pricing = useMemo(
    () => (data ? branchCheckoutTotalCents(data, catalogServiceId || null, selectedAddonIds, tipCents) : null),
    [data, catalogServiceId, selectedAddonIds, tipCents]
  );

  const washersBusyInPickedSlot = useMemo(() => {
    if (!data || !pickedBaySlot) return new Set<string>();
    return washerIdsBusyInSlot(
      data.branchBookings,
      slotDate,
      pickedBaySlot.startTime,
      pickedBaySlot.endTime
    );
  }, [data, slotDate, pickedBaySlot]);

  const washers = useMemo(() => {
    const active = data?.washers.filter((w) => w.active) ?? [];
    const byId = new Map(active.map((w) => [w.id, w]));
    const unique = Array.from(byId.values());
    if (!pickedBaySlot) return unique;
    return unique.filter((w) => !washersBusyInPickedSlot.has(w.id));
  }, [data, pickedBaySlot, washersBusyInPickedSlot]);

  const durationMins = data ? normalizeSlotDurationMinutes(data.managerSlotDurationMinutes) : 60;

  const allDaySlots = useMemo(() => {
    if (!branch) return [];
    return generateOperatingDaySlots(
      branch.openTime,
      branch.closeTime,
      branch.bayCount,
      durationMins
    );
  }, [branch, durationMins]);

  /** Total booking duration based on selected service + add-ons (matches user portal logic). */
  const bookingDurationMinutes = useMemo(() => {
    const svc = catalogServiceId ? findCatalogServiceById(data, catalogServiceId) : undefined;
    return totalMinutesForServiceAndAddons(svc?.durationMinutes ?? 60, selectedAddonIds.length);
  }, [data, catalogServiceId, selectedAddonIds]);

  /** Only show start slots where the full booking fits before branch close. */
  const daySlots = useMemo(() => {
    if (!branch) return allDaySlots;
    const closeM = parseTimeToMinutes(branch.closeTime);
    const closeAbs = closeM <= parseTimeToMinutes(branch.openTime) ? closeM + 24 * 60 : closeM;
    return allDaySlots.filter((s) => parseTimeToMinutes(s.startTime) + bookingDurationMinutes <= closeAbs);
  }, [allDaySlots, branch, bookingDurationMinutes]);

  const runLookup = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const preferPhone = cleanPhone.length === 9;
    const em = email.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    if (!preferPhone && !emailOk) return;
    setLookupStatus('loading');
    try {
      // Send both phone AND email so backend can match on either.
      const result = await managerLookupCustomer({
        phone: cleanPhone.length === 9 ? `+61${cleanPhone}` : undefined,
        email: emailOk ? em : undefined,
      });
      const isGuest = !!(result as { guest?: boolean })?.guest;
      const hasResult = !!(result?.id || isGuest);
      if (hasResult) {
        const rawName = String((result as { full_name?: string }).full_name ?? (result as { name?: string }).name ?? '');
        const name = rawName.replace(/\s*\bCUST_[A-Z0-9]{3,8}\b/gi, '').trim();
        setCustomerName(name);
        if ((result as { email?: string }).email) setEmail(String((result as { email?: string }).email));
        setIsGuestCustomer(isGuest);
        setCustomerId(result?.id ? String(result.id) : null);
        setLookupStatus(isGuest ? 'guest' : 'existing');
        const storedPhone = String((result as { phone?: string }).phone ?? '');
        if (storedPhone) {
          const digits = storedPhone.replace(/\D/g, '');
          let local = digits;
          if (local.startsWith('61') && local.length >= 11) local = local.slice(2);
          else if (local.startsWith('0') && local.length >= 10) local = local.slice(1);
          if (local.length >= 9) setPhone(local.slice(-9));
        }
        const vehicles = (result as { vehicles?: { type?: string; name?: string; model?: string; registration?: string; number?: string }[] }).vehicles ?? [];
        const mapped = vehicles.map((v) => ({
          type: v.type ?? '',
          name: v.name ?? v.model ?? '',
          registration: v.registration ?? v.number ?? '',
        }));
        setCustomerVehicles(mapped);
        if (mapped.length) {
          const v0 = mapped[0]!;
          if (v0.type) setVehicleType(v0.type);
          setVehicleName(v0.name);
          setRegistrationNumber(v0.registration);
        }
        const addrs = (result as { saved_addresses?: SavedAddress[] }).saved_addresses ?? [];
        const legacyLine = String((result as { address?: string }).address ?? '').trim();
        if (isGuest) {
          // Guests: address fields only (no saved-address dropdown).
          setSavedAddresses([]);
          const guestAddr = addrs.find((a) => a.is_default) ?? addrs[0];
          if (guestAddr) {
            const parsed = {
              street_address: guestAddr.street_address,
              suburb: guestAddr.suburb,
              state: guestAddr.state,
              postcode: guestAddr.postcode,
            };
            if (!parsed.street_address && legacyLine) parsed.street_address = legacyLine;
            setAddress(parsed);
          } else if (legacyLine) {
            const parsed = parseAddressString(legacyLine);
            if (!parsed.street_address) parsed.street_address = legacyLine;
            setAddress(parsed);
          }
        } else {
          const effectiveAddrs: SavedAddress[] =
            addrs.length > 0
              ? addrs
              : legacyLine
                ? [{ id: '__legacy__', label: 'Saved address', ...parseAddressString(legacyLine), is_default: true }]
                : [];
          setSavedAddresses(effectiveAddrs);
          const defaultAddr = effectiveAddrs.find((a) => a.is_default) ?? effectiveAddrs[0];
          if (defaultAddr) {
            const parsed = {
              street_address: defaultAddr.street_address,
              suburb: defaultAddr.suburb,
              state: defaultAddr.state,
              postcode: defaultAddr.postcode,
            };
            if (!parsed.street_address && legacyLine) parsed.street_address = legacyLine;
            setAddress(parsed);
          }
        }
      } else {
        setCustomerId(null);
        setIsGuestCustomer(false);
        setCustomerVehicles([]);
        setSavedAddresses([]);
        setLookupStatus('new');
      }
    } catch (e) {
      console.error('Lookup failed', e);
      setCustomerId(null);
      setLookupStatus('idle');
    }
  };

  useEffect(() => {
    setPickedBaySlot(null);
    setFormError('');
  }, [slotDate, branchId, durationMins, branch?.openTime, branch?.closeTime, branch?.bayCount]);

  useEffect(() => {
    if (washers.length === 0) {
      setWasherId('');
      return;
    }
    // If current washerId is no longer in the available list, clear it (don't auto-pick).
    if (washerId && !washers.some((w) => w.id === washerId)) {
      setWasherId('');
    }
  }, [washers, washerId]);

  useEffect(() => {
    if (!pickedBaySlot || !data) return;
    const busy = washerIdsBusyInSlot(
      data.branchBookings,
      slotDate,
      pickedBaySlot.startTime,
      pickedBaySlot.endTime
    );
    if (washerId && busy.has(washerId)) {
      const next = data.washers.find((w) => w.active && !busy.has(w.id))?.id ?? '';
      setWasherId(next);
    }
  }, [pickedBaySlot, slotDate, data, washerId]);

  useEffect(() => {
    if (vehicleTypes.length === 0) return;
    if (!vehicleTypes.includes(vehicleType)) {
      setVehicleType(vehicleTypes[0]!);
    }
  }, [vehicleTypes, vehicleType]);

  useEffect(() => {
    if (!catalogServiceId) return;
    if (!serviceOptions.some((s) => s.id === catalogServiceId)) {
      setCatalogServiceId('');
      setServiceSummary('');
    }
  }, [vehicleType, serviceOptions, catalogServiceId]);

  /** Extend or re-check the painted booking span when service or add-ons change (matches backend duration). */
  useEffect(() => {
    if (!pickedBaySlot || !data || !branch) return;
    const svc = catalogServiceId ? findCatalogServiceById(data, catalogServiceId) : undefined;
    const et = branchBookingEndHHMM(
      pickedBaySlot.startTime,
      svc?.durationMinutes ?? 60,
      selectedAddonIds.length
    );
    if (et === pickedBaySlot.endTime) return;
    const st = pickedBaySlot.startTime;
    const wk = slotWindowKey(st, et);
    const eff = getEffectiveSlotState(scheduleSliceFromBranchData(data), slotDate, wk, branch.bayCount);
    if (!eff.slotActive || !eff.baysOpen[pickedBaySlot.bayNumber - 1]) {
      setFormError('This bay is not open for the full service + add-ons window. Pick another slot.');
      setPickedBaySlot(null);
      return;
    }
    if (findBookingForBayWindow(data.branchBookings, slotDate, st, et, pickedBaySlot.bayNumber)) {
      setFormError('Another booking overlaps this span. Pick another slot.');
      setPickedBaySlot(null);
      return;
    }
    setFormError('');
    setPickedBaySlot({ ...pickedBaySlot, endTime: et });
  }, [pickedBaySlot, catalogServiceId, selectedAddonIds, slotDate, data, branch]);

  if (!session || !branch || !data) return null;

  const onPickBaySlot = (p: { startTime: string; endTime: string; bayNumber: number }) => {
    const svc = catalogServiceId ? findCatalogServiceById(data, catalogServiceId) : undefined;
    const et = branchBookingEndHHMM(p.startTime, svc?.durationMinutes ?? 60, selectedAddonIds.length);
    const wk = slotWindowKey(p.startTime, et);
    const eff = getEffectiveSlotState(scheduleSliceFromBranchData(data), slotDate, wk, branch.bayCount);
    if (!eff.slotActive || !eff.baysOpen[p.bayNumber - 1]) {
      setFormError('That bay is closed for part of this service + add-ons window. Pick another cell.');
      return;
    }
    if (findBookingForBayWindow(data.branchBookings, slotDate, p.startTime, et, p.bayNumber)) {
      setFormError('That bay is not free for the full service + add-ons. Pick another cell.');
      return;
    }
    setPickedBaySlot({ startTime: p.startTime, endTime: et, bayNumber: p.bayNumber });
    setFormError('');
  };

  const patchJob = (id: string, patch: Partial<BranchBookingJob>) => {
    if (patch.status != null && patch.status !== 'completed' && patch.status !== 'cancelled') {
      return;
    }
    updateBranchData(branchId, (d) => ({
      ...d,
      branchBookings: d.branchBookings.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    }));
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const validateBooking = (): string | null => {
    const name = customerName.trim();
    const phoneValue = phone.trim();
    const emailValue = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !slotDate) return 'Enter customer name and date.';
    if (phone.length !== 9) return 'Enter exactly 9 digits for the phone number.';
    if (!emailValue) return 'Enter email address.';
    if (!emailRegex.test(emailValue)) return 'Enter a valid email address.';
    if (daySlots.length === 0) return 'No slots are available for this branch configuration.';
    if (!washerId || !washers.some((w) => w.id === washerId)) return 'Select a washer.';
    if (!pickedBaySlot) return 'Pick an available bay cell for the selected date.';
    if (!catalogServiceId) return 'Select a service for this vehicle.';
    const st = pickedBaySlot.startTime;
    const svc = findCatalogServiceById(data, catalogServiceId);
    const et = branchBookingEndHHMM(st, svc?.durationMinutes ?? 60, selectedAddonIds.length);
    const bay = pickedBaySlot.bayNumber;
    const wk = slotWindowKey(st, et);
    const eff = getEffectiveSlotState(scheduleSliceFromBranchData(data), slotDate, wk, branch.bayCount);
    if (!eff.slotActive || !eff.baysOpen[bay - 1]) {
      return 'That bay or slot is closed for this date. Choose another cell.';
    }
    if (findBookingForBayWindow(data.branchBookings, slotDate, st, et, bay)) {
      return 'That bay is not free for the full service duration starting at this time. Pick another cell.';
    }
    const busyWashers = washerIdsBusyInSlot(data.branchBookings, slotDate, st, et);
    if (busyWashers.has(washerId)) {
      return 'That washer is already assigned in this time slot. Pick another washer.';
    }
    if (!paymentMethod) return 'Select a payment method.';
    
    // Final sanity check for past time
    const today = todayLocalISO();
    if (slotDate < today) return 'Cannot book a past date.';
    if (slotDate === today && st < currentHHMM()) return 'This time slot has already passed today.';
    
    return null;
  };

  const buildJob = (): BranchBookingJob => {
    const name = customerName.trim();
    const addr = composeAddress(address);
    const st = pickedBaySlot!.startTime;
    const svc = findCatalogServiceById(data, catalogServiceId);
    const et = branchBookingEndHHMM(st, svc?.durationMinutes ?? 60, selectedAddonIds.length);
    const bay = pickedBaySlot!.bayNumber;
    return {
      id: branchStoreApi.generateBookingJobId(),
      customerName: name,
      address: addr,
      email: email.trim(),
      phone: `+61${phone.trim()}`,
      customerId: customerId,
      vehicleType: vehicleType.trim() || '—',
      vehicleName: vehicleName.trim(),
      registrationNumber: registrationNumber.trim(),
      serviceSummary: serviceSummary.trim() || '—',
      serviceId: catalogServiceId.trim() || null,
      selectedAddonIds: [...selectedAddonIds],
      slotDate,
      startTime: st,
      endTime: et,
      bayNumber: bay,
      assignedWasherId: washerId,
      status: washerId ? 'assigned' : 'scheduled',
      source: 'walk_in',
      notes: notes.trim(),
      managerNotes: notes.trim(),
      tipCents,
      serviceChargedCents: pricing ? Math.round(pricing.subtotal * 100) : undefined,
      paymentMethod: paymentMethod || 'pay_after',
      createdAt: new Date().toISOString(),
    };
  };

  const resetForm = () => {
    setCustomerName('');
    setAddress(EMPTY_ADDRESS);
    setAddressErrors({});
    setEmail('');
    setPhone('');
    setCustomerId(null);
    setIsGuestCustomer(false);
    setLookupStatus('idle');
    setCustomerVehicles([]);
    setSavedAddresses([]);
    setVehicleType(vehicleTypes[0] ?? '');
    setVehicleName('');
    setRegistrationNumber('');
    setCatalogServiceId('');
    setServiceSummary('');
    setNotes('');
    setSelectedAddonIds([]);
    setTipDollars('');
    setPickedBaySlot(null);
    setWasherId('');
    setPaymentMethod('pay_after');
  };

  const onCreateBooking = async () => {
    setFormError('');
    const err = validateBooking();
    if (err) {
      setFormError(err);
      window.alert(`Validation Error: ${err}`);
      return;
    }

    if (paymentMethod === 'card' || paymentMethod === 'apple_pay') {
      setIsProcessing(true);
      // Simulate real payment delay
      await new Promise((res) => setTimeout(res, 1800));
      setIsProcessing(false);
    }

    const job = buildJob();
    setIsCreatingBooking(true);
    try {
      const saved = await createBranchManagerBooking(job);
      await refresh();
      setLastReceipt(saved);
      setLastPaymentMethod(paymentMethod);
      setReceiptOpen(true);
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : 'Failed to create booking. Please try again.'
      );
    } finally {
      setIsCreatingBooking(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Create Booking</h1>

      <div
        className={cn(
          shell,
          // Cap height to the visible manager pane — avoid nested 100vh + layout min-h-full dead scroll below the card.
          'flex min-h-0 w-full max-w-full flex-col max-h-[min(88dvh,900px)]',
          'lg:flex-row lg:items-stretch lg:h-[min(700px,calc(100dvh-13.5rem))]',
        )}
      >
        <aside className="flex min-h-0 w-full shrink-0 flex-col gap-2 overflow-hidden border-b border-slate-200/80 bg-slate-50/60 p-3 lg:w-[38%] lg:min-w-[260px] lg:border-b-0 lg:border-r lg:self-stretch">
          <div className="shrink-0">
            <CalendarPopover
              slotDate={slotDate}
              resetKey={branchId}
              onDateChange={(iso) => {
                setSlotDate(iso);
                setFormError('');
              }}
            />
          </div>
          {daySlots.length === 0 ? (
            <p className="text-xs text-amber-800">No slots — check branch hours and Configure bay.</p>
          ) : (
            <SlotSelector
              branch={branch}
              pickerData={data}
              daySlots={daySlots}
              slotDate={slotDate}
              selectedBaySlot={pickedBaySlot}
              onSelectBaySlot={onPickBaySlot}
              mode="assign"
              washers={washers}
              onPatchJob={patchJob}
              managerTerminalStatusOnly
              density="dense"
              hideBookedCellControls
              className="min-h-0 flex-1"
            />
          )}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden lg:min-h-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">

            {/* ── 1. Customer Lookup ─────────────────────────────── */}
            <div className="mb-5 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer Lookup</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="cb-phone-lookup">Phone</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-xs font-medium">+61</span>
                    <input
                      id="cb-phone-lookup"
                      className="h-10 flex-1 rounded-r-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPhone(val.slice(0, 9));
                        setLookupStatus('idle');
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void runLookup(); }}
                      placeholder="4XXXXXXXX"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cb-email-lookup">Email</Label>
                  <input
                    id="cb-email-lookup"
                    type="email"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLookupStatus('idle'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void runLookup(); }}
                    placeholder="customer@example.com"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={lookupStatus === 'loading' || (phone.replace(/\D/g, '').length !== 9 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))}
                onClick={() => void runLookup()}
              >
                {lookupStatus === 'loading' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</>
                ) : 'Check Customer'}
              </Button>

              {/* Status banner */}
              {lookupStatus === 'existing' && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">✓ User found</span>
                  <span className="text-xs text-emerald-800">Existing account — fields auto-filled. Booking will link to their account.</span>
                </div>
              )}
              {lookupStatus === 'guest' && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">⚡ Guest found</span>
                  <span className="text-xs text-amber-800">Details auto-filled from their last guest booking.</span>
                </div>
              )}
              {lookupStatus === 'new' && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="inline-flex items-center rounded-full bg-slate-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">＋ New customer</span>
                  <span className="text-xs text-slate-600">No existing account or booking found. Fill in the details below.</span>
                </div>
              )}
            </div>

            {/* ── 2. Customer & Vehicle Details ──────────────────── */}
            <div className="mb-5 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer &amp; Vehicle Details</p>
              <div className="grid gap-2">
                <Label htmlFor="cb-name-detail">Customer name *</Label>
                <input
                  id="cb-name-detail"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {customerVehicles.length > 0 && customerId && !isGuestCustomer ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saved vehicle</label>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      value={vehicleType}
                      onChange={(e) => {
                        const v = customerVehicles.find((x) => x.type === e.target.value);
                        if (!v) return;
                        setVehicleType(v.type);
                        setVehicleName(v.name);
                        setRegistrationNumber(v.registration);
                      }}
                    >
                      {customerVehicles.map((v, i) => (
                        <option key={i} value={v.type}>
                          {[v.type, v.name].filter(Boolean).join(' — ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Vehicle name</label>
                      <input
                        type="text"
                        value={vehicleName}
                        onChange={(e) => setVehicleName(e.target.value)}
                        placeholder="e.g. Toyota Corolla"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Registration</label>
                      <input
                        type="text"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. ABC123"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="cb-vtype">Vehicle type</Label>
                      {vehicleTypes.length > 0 ? (
                        <select
                          id="cb-vtype"
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                        >
                          {vehicleTypes.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="cb-vtype"
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                          placeholder="e.g. SUV"
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cb-vname">Vehicle name</Label>
                      <input
                        id="cb-vname"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                        value={vehicleName}
                        onChange={(e) => setVehicleName(e.target.value)}
                        placeholder="e.g. Toyota Corolla"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cb-reg">Registration number</Label>
                    <input
                      id="cb-reg"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. ABC 123"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── 3–5. Service / Address / Add-ons / Notes via BookingForm ── */}
            <BookingForm
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              email={email}
              onEmailChange={setEmail}
              phone={phone}
              onPhoneChange={setPhone}
              address={address}
              onAddressChange={setAddress}
              vehicleType={vehicleType}
              onVehicleTypeChange={setVehicleType}
              vehicleName={vehicleName}
              onVehicleNameChange={setVehicleName}
              registrationNumber={registrationNumber}
              onRegistrationNumberChange={setRegistrationNumber}
              vehicleTypes={vehicleTypes}
              serviceOptions={serviceOptions}
              catalogServiceId={catalogServiceId}
              onCatalogServiceIdChange={setCatalogServiceId}
              serviceSummary={serviceSummary}
              onServiceSummaryChange={setServiceSummary}
              assignees={washers.map((w) => ({ id: w.id, label: w.name?.trim() || w.loginId }))}
              assigneeId={washerId}
              onAssigneeIdChange={setWasherId}
              assigneeLabel="Washer"
              savedAddresses={isGuestCustomer ? [] : savedAddresses}
              addressErrors={addressErrors}
              addressOptional
              hidePhone
              hideEmail
              hideCustomerName
              hideVehicleDetails
              hideAssignee
              hideNotes
              hideService
              notes={notes}
              onNotesChange={setNotes}
              formError={formError}
            />

            {/* ── 3b. Service picker ─────────────────────────────── */}
            <div className="mt-5 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Service *</p>
              {fullServiceItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services in catalog for this vehicle type.</p>
              ) : (
                <div className="grid gap-2">
                  {fullServiceItems.map((svc) => {
                    const selected = catalogServiceId === svc.id;
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => {
                          setCatalogServiceId(svc.id);
                          setServiceSummary(svc.name);
                        }}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                          selected
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400/30'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'
                        }`}
                      >
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-900 text-sm">{svc.name}</span>
                              {svc.recommended && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  ★ Recommended
                                </span>
                              )}
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                svc.category === 'Detailing'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-sky-100 text-sky-700'
                              }`}>
                                {svc.category}
                              </span>
                              {svc.eligibleForLoyaltyPoints && !isGuestCustomer && customerId && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  ♦ Counts for loyalty
                                </span>
                              )}
                              {svc.freeCoffeeCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                  ☕ {svc.freeCoffeeCount} free coffee{svc.freeCoffeeCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">{svc.durationMinutes} min</p>
                          </div>
                          <span className={`shrink-0 text-base font-bold ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
                            ${svc.price.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 4. Add-ons ─────────────────────────────────────── */}
            {addonChoices.length > 0 ? (
              <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
                <Label className="text-base">Add-ons (+30 min each)</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {addonChoices.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAddonIds.includes(a.id)}
                        onChange={() => toggleAddon(a.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        {a.name}{' '}
                        <span className="text-muted-foreground">(${Number(a.price).toFixed(2)})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ── 5. Notes ───────────────────────────────────────── */}
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
              <Label className="text-base">Notes</Label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                placeholder="Any special instructions…"
              />
            </div>

            {/* ── 6. Washer Assignment ───────────────────────────── */}
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
              <Label className="text-base">Washer Assignment</Label>
              {washers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active washers available for this slot.</p>
              ) : (
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  value={washerId}
                  onChange={(e) => setWasherId(e.target.value)}
                >
                  <option value="">Select a washer</option>
                  {washers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name?.trim() || w.loginId}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ── Tip ───────────────────────────────────────────── */}
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
              <Label htmlFor="cb-tip" className="text-base">Tip (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">$</span>
                <input
                  id="cb-tip"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0.00"
                  value={tipDollars}
                  onChange={(e) => setTipDollars(e.target.value)}
                  className="h-10 w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
              </div>
            </div>

            <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold text-slate-900">Payment Selection</Label>
                {pricing && (
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Amount</p>
                    <p className="text-2xl font-black text-indigo-600">
                      ${(pricing.totalCents / 100).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />

              {pricing ? (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>Service price (inc GST)</span>
                    <span>${pricing.servicePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>Add-ons (inc GST)</span>
                    <span>${pricing.addonsTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>Tip</span>
                    <span>${(tipCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200/80 mt-2 pt-2">
                    <span>Total due</span>
                    <span>${(pricing.totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
            <Button 
              type="button" 
              variant="default" 
              className="min-w-[14rem] h-12 rounded-xl font-bold text-base shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-1px] active:translate-y-[0px] disabled:opacity-70 disabled:cursor-not-allowed" 
              onClick={onCreateBooking}
              disabled={isProcessing || isCreatingBooking || !paymentMethod}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing Payment...
                </>
              ) : isCreatingBooking ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating booking...
                </>
              ) : (
                'Create & Finalize Booking'
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking confirmed</DialogTitle>
          </DialogHeader>
          {lastReceipt ? (() => {
            const receiptAddons = addonChoices.filter((a) => (lastReceipt.selectedAddonIds ?? []).includes(a.id));
            const statusLabel = lastReceipt.status.charAt(0).toUpperCase() + lastReceipt.status.slice(1).replace(/_/g, ' ');
            const hex = lastReceipt.id.replace(/-/g, '').slice(-6).toUpperCase();
            const shortId = (() => {
              if (lastReceipt.customerId) {
                return '#' + hex + '-' + lastReceipt.customerId.replace(/-/g, '').slice(-4).toUpperCase();
              }
              if (lastReceipt.phone) {
                const digits = lastReceipt.phone.replace(/\D/g, '');
                if (digits) {
                  const num = parseInt(digits.slice(-9), 10);
                  const suffix = num.toString(36).toUpperCase().slice(-4).padStart(4, '0');
                  return '#' + hex + '-' + suffix;
                }
              }
              return '#' + hex;
            })();
            return (
              <div className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Booking #</span>
                  <span className="font-mono font-semibold">{shortId}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Status</span>
                  <span>{statusLabel}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Date & time</span>
                  <span className="text-right">{lastReceipt.slotDate} {lastReceipt.startTime}–{lastReceipt.endTime}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Service</span>
                  <span className="text-right">{lastReceipt.serviceSummary?.split('+')[0]?.trim()}</span>
                </div>
                {receiptAddons.length > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="shrink-0 text-muted-foreground">Add-ons</span>
                    <span className="text-right">{receiptAddons.map((a) => a.name).join(', ')}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Payment</span>
                  <span>{lastPaymentMethod === 'pay_after' ? 'Pay after service' : lastPaymentMethod === 'card' ? 'Credit / Debit Card' : 'Apple Pay'}</span>
                </div>
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
