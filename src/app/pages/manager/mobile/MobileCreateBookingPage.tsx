import { useMemo, useState, useEffect, useCallback } from 'react';
import { useMobileManagerSession } from '../../../hooks/useMobileManagerSession';
import { useMobileServicesStore } from '../../../hooks/useMobileServicesStore';
import {
  countActiveMobileDriversForPin,
  countMobileJobsInWindow,
  findMobileCatalogServiceById,
  getEffectiveMobileSlotState,
  getEffectiveMobileSlotWindowActive,
  getMobileOpsForPin,
  listMobileVehicleTypes,
  mobileServicesStoreApi,
  isValidPinCode,
  normalizePinCode,
  type MobileManagerJob,
} from '../../../lib/mobileServicesStore';
import {
  formatMinutesToHHMM,
  generateOperatingDaySlots,
  intervalsOverlapHHMM,
  normalizeSlotDurationMinutes,
  parseTimeToMinutes,
  slotWindowKey,
  totalMinutesForServiceAndAddons,
} from '../../../lib/branchSlotSchedule';
import { todayLocalISO, currentHHMM } from '../../../lib/managerPortalUtils';
import { CalendarPopover } from '../../../components/manager/edit-branch-booking/CalendarPopover';
import { BookingForm } from '../../../components/manager/create-booking/BookingForm';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { mobileCheckoutTotalCents } from '../../../lib/managerCheckoutPricing';
import { cn } from '../../../components/ui/utils';
import { PaymentSelector, type PaymentMethod } from '../../../components/manager/PaymentSelector';
import { Loader2 } from 'lucide-react';
import {
  extractZipFromAddress,
  isDriverBusyForWindow,
  isDriverServiceableForZip,
  listMobileDriversForBookingZip,
} from '../../../lib/mobileDriverEligibility';
import { mobileManagerLookupCustomer } from '../../../lib/mobileApi';
import type { SavedAddress, StructuredAddress } from '../../../components/manager/create-booking/BookingForm';
import {
  composeAddress,
  parseAddressString,
  validateAddress,
  isAddressComplete,
  EMPTY_ADDRESS,
} from '../../../components/manager/create-booking/AddressFormFields';

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]';

function mobileJobStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled': return 'Booked';
    case 'assigned': return 'Assigned';
    case 'arrived':
    case 'checked_in': return 'Arrived';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

function getJobForDriverInWindow(
  jobs: MobileManagerJob[],
  date: string,
  startTime: string,
  endTime: string,
  driverId: string
): MobileManagerJob | undefined {
  return jobs.find(
    (j) =>
      j.slotDate === date &&
      j.assignedStaffId === driverId &&
      !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status) &&
      intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)
  );
}

function isJobAssignedToDriverInWindow(
  jobs: MobileManagerJob[],
  slotDate: string,
  startTime: string,
  endTime: string,
  driverId: string
): boolean {
  return jobs.some(
    (j) =>
      j.slotDate === slotDate &&
      !['cancelled', 'completed', 'rejected', 'failed'].includes(j.status) &&
      j.assignedStaffId === driverId &&
      intervalsOverlapHHMM(startTime, endTime, j.startTime, j.endTime)
  );
}

type LookupStatus = 'idle' | 'loading' | 'existing' | 'guest' | 'new';

export default function MobileCreateBookingPage() {
  const { session } = useMobileManagerSession();
  const { state, staff, updateMobileOpsForPinAsync } = useMobileServicesStore();
  const mobileAddons = state.mobileAddons ?? [];
  const pin = session?.cityPinCode ? normalizePinCode(session.cityPinCode) : '';
  const ops = useMemo(() => (pin ? getMobileOpsForPin(state, pin) : null), [state, pin]);
  const driverCount = useMemo(() => (pin ? countActiveMobileDriversForPin(staff, pin) : 0), [staff, pin]);
  const activeDrivers = useMemo(
    () => staff.filter((s) => normalizePinCode(s.cityPinCode) === pin && s.active),
    [staff, pin]
  );

  const vehicleTypes = useMemo(() => listMobileVehicleTypes(state.vehicleCatalog), [state.vehicleCatalog]);

  const [slotDate, setSlotDate] = useState(todayLocalISO());
  const [slotKey, setSlotKey] = useState('');

  const capacity = Math.max(1, driverCount);
  const durationMins = normalizeSlotDurationMinutes(ops?.slotDurationMinutes ?? 60);

  const allDaySlots = useMemo(() => {
    if (!ops) return [];
    return generateOperatingDaySlots(ops.openTime, ops.closeTime, capacity, durationMins);
  }, [ops, capacity, durationMins]);

  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState<StructuredAddress>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof StructuredAddress, string>>>({});
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [catalogServiceId, setCatalogServiceId] = useState('');
  const [serviceSummary, setServiceSummary] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState<string>('none');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isGuestCustomer, setIsGuestCustomer] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState<{ type?: string; name?: string; registration?: string }[]>([]);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');

  /** Total booking duration based on selected service + add-ons. */
  const bookingDurationMinutes = useMemo(() => {
    const svcMeta = catalogServiceId
      ? findMobileCatalogServiceById(state.vehicleCatalog, catalogServiceId)
      : undefined;
    return totalMinutesForServiceAndAddons(svcMeta?.durationMinutes ?? 60, selectedAddonIds.length);
  }, [state.vehicleCatalog, catalogServiceId, selectedAddonIds]);

  /** Only show start slots where the full booking fits before close time. */
  const daySlots = useMemo(() => {
    if (!ops) return allDaySlots;
    const closeM = parseTimeToMinutes(ops.closeTime);
    const openM = parseTimeToMinutes(ops.openTime);
    const closeAbs = closeM <= openM ? closeM + 24 * 60 : closeM;
    return allDaySlots.filter((s) => parseTimeToMinutes(s.startTime) + bookingDurationMinutes <= closeAbs);
  }, [allDaySlots, ops, bookingDurationMinutes]);

  /** Highlight only after manager picks a slot+driver on the calendar (no silent default). */
  const effectiveSlotKey = slotKey;

  const hasBookableSlot = useMemo(() => {
    if (!ops) return false;
    return daySlots.some((s) => {
      const eff = getEffectiveMobileSlotState(ops, slotDate, s.startTime, s.endTime, capacity);
      if (!eff.slotActive) return false;
      const booked = countMobileJobsInWindow(ops.jobs, slotDate, s.startTime, s.endTime);
      return booked < s.maxConcurrentVehicles;
    });
  }, [ops, daySlots, slotDate, capacity, ops?.jobs]);

  const [tipDollars, setTipDollars] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<MobileManagerJob | null>(null);
  const [lastPaymentMethod, setLastPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('pay_after');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const bookingZip = useMemo(() => extractZipFromAddress(address.postcode || composeAddress(address)), [address]);

  const tipCents = Math.min(50_000, Math.max(0, Math.round((parseFloat(tipDollars) || 0) * 100)));

  /** Full service items for card picker (includes price, duration, badges). */
  const fullServiceItems = useMemo(() => {
    if (!vehicleType) return [];
    const vb = state.vehicleCatalog.find((v) => v.vehicleType === vehicleType);
    return (vb?.services ?? []).filter((s) => s.active !== false);
  }, [state.vehicleCatalog, vehicleType]);

  const addonChoices = useMemo(() => mobileAddons.filter((a) => a.active !== false), [mobileAddons]);

  const pricing = useMemo(
    () =>
      mobileCheckoutTotalCents(
        state.vehicleCatalog,
        mobileAddons,
        catalogServiceId || null,
        selectedAddonIds,
        tipCents
      ),
    [state.vehicleCatalog, mobileAddons, catalogServiceId, selectedAddonIds, tipCents]
  );

  const zipEligibleDrivers = useMemo(
    () => (pin ? listMobileDriversForBookingZip(staff, pin, bookingZip) : []),
    [staff, pin, bookingZip]
  );

  /** Drivers available for the currently selected slot window. */
  const driversForSlot = useMemo(() => {
    const [st, et] = effectiveSlotKey.split('|');
    if (!st || !et) return zipEligibleDrivers;
    return zipEligibleDrivers.filter(
      (d) => !isJobAssignedToDriverInWindow(ops?.jobs ?? [], slotDate, st, et, d.id)
    );
  }, [zipEligibleDrivers, effectiveSlotKey, slotDate, ops?.jobs]);

  const runLookup = useCallback(async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const preferPhone = cleanPhone.length === 9;
    const em = email.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    if (!preferPhone && !emailOk) return;
    setLookupStatus('loading');
    try {
      const result = await mobileManagerLookupCustomer({
        phone: cleanPhone.length === 9 ? `+61${cleanPhone}` : undefined,
        email: emailOk ? em : undefined,
      });
      const isGuest = !!(result as { guest?: boolean })?.guest;
      const hasResult = !!(result?.id || isGuest);
      if (!hasResult) {
        setCustomerId(null);
        setIsGuestCustomer(false);
        setCustomerVehicles([]);
        setSavedAddresses([]);
        setLookupStatus('new');
        return;
      }
      setCustomerId(result?.id ? String(result.id) : null);
      setIsGuestCustomer(isGuest);
      setLookupStatus(isGuest ? 'guest' : 'existing');
      const rawName = String((result as { full_name?: string }).full_name ?? (result as { name?: string }).name ?? '');
      const name = rawName.replace(/\s*\bCUST_[A-Z0-9]{3,8}\b/gi, '').trim();
      setCustomerName(name);
      if ((result as { email?: string }).email) setEmail(String((result as { email?: string }).email));
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
        if (v0.type && vehicleTypes.includes(v0.type)) setVehicleType(v0.type);
        setVehicleName(v0.name ?? '');
        setRegistrationNumber(v0.registration ?? '');
      }
      const addrs = (result as { saved_addresses?: SavedAddress[] }).saved_addresses ?? [];
      const legacyAddressLine = String((result as { address?: string }).address ?? '').trim();
      if (isGuest) {
        setSavedAddresses([]);
        const guestAddr = addrs.find((a) => a.is_default) ?? addrs[0];
        if (guestAddr) {
          setAddress({ street_address: guestAddr.street_address, suburb: guestAddr.suburb, state: guestAddr.state, postcode: guestAddr.postcode });
        } else if (legacyAddressLine) {
          const parsed = parseAddressString(legacyAddressLine);
          if (!parsed.street_address) parsed.street_address = legacyAddressLine;
          setAddress(parsed);
        }
      } else {
        const effectiveAddrs: SavedAddress[] =
          addrs.length > 0
            ? addrs
            : legacyAddressLine
              ? [{ id: '__legacy__', label: 'Saved address', ...parseAddressString(legacyAddressLine), is_default: true }]
              : [];
        setSavedAddresses(effectiveAddrs);
        const defaultAddr = effectiveAddrs.find((a) => a.is_default) ?? effectiveAddrs[0];
        if (defaultAddr) {
          setAddress({ street_address: defaultAddr.street_address, suburb: defaultAddr.suburb, state: defaultAddr.state, postcode: defaultAddr.postcode });
        }
      }
    } catch {
      setCustomerId(null);
      setIsGuestCustomer(false);
      setLookupStatus('idle');
    }
  }, [phone, email, vehicleTypes]);

  useEffect(() => {
    setFormError('');
  }, [slotDate, pin]);

  useEffect(() => {
    if (!slotKey || !ops) return;
    const s = daySlots.find((x) => slotWindowKey(x.startTime, x.endTime) === slotKey);
    if (!s) { setSlotKey(''); return; }
    const eff = getEffectiveMobileSlotState(ops, slotDate, s.startTime, s.endTime, capacity);
    const booked = countMobileJobsInWindow(ops.jobs, slotDate, s.startTime, s.endTime);
    if (!eff.slotActive || booked >= s.maxConcurrentVehicles) setSlotKey('');
  }, [slotKey, daySlots, ops, slotDate, capacity, ops?.jobs]);

  useEffect(() => {
    if (!ops || assignedStaffId === 'none') return;
    const [st, et] = effectiveSlotKey.split('|');
    if (!st || !et) return;
    if (isJobAssignedToDriverInWindow(ops.jobs, slotDate, st, et, assignedStaffId)) {
      setAssignedStaffId('none');
    }
  }, [ops, assignedStaffId, slotDate, effectiveSlotKey, ops?.jobs]);

  useEffect(() => {
    if (!vehicleTypes.length) return;
    if (!vehicleType || !vehicleTypes.includes(vehicleType)) setVehicleType(vehicleTypes[0]!);
  }, [vehicleTypes, vehicleType]);

  useEffect(() => {
    if (!catalogServiceId) return;
    if (!fullServiceItems.some((s) => s.id === catalogServiceId)) {
      setCatalogServiceId('');
      setServiceSummary('');
    }
  }, [fullServiceItems, catalogServiceId]);

  if (!session || !isValidPinCode(pin) || !ops) return null;

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const validateMobile = (): { error: string } | { startTime: string; slotEndFromGrid: string; endTime: string } => {
    const name = customerName.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name) return { error: 'Enter customer name.' };
    const addrErrs = validateAddress(address);
    const hasAddrError = Object.values(addrErrs).some(Boolean);
    if (hasAddrError) {
      setAddressErrors(addrErrs);
      return { error: 'Complete the service address fields.' };
    }
    setAddressErrors({});
    if (phone.length !== 9) return { error: 'Enter exactly 9 digits for the phone number.' };
    if (!email) return { error: 'Enter email address.' };
    if (!emailRegex.test(email)) return { error: 'Enter a valid email address.' };
    if (!catalogServiceId) return { error: 'Select a service for this vehicle.' };
    if (!slotKey || slotKey === '|') return { error: 'Select a time slot and driver on the calendar.' };
    if (assignedStaffId === 'none') return { error: 'Select a driver on the calendar or from Driver Assignment.' };
    const [startTime, slotEndFromGrid] = slotKey.split('|');
    if (!startTime || !slotEndFromGrid) return { error: 'Invalid time window.' };
    const svcMeta = catalogServiceId ? findMobileCatalogServiceById(state.vehicleCatalog, catalogServiceId) : undefined;
    const addonMins = selectedAddonIds.length * 30;
    const endTime = svcMeta
      ? formatMinutesToHHMM(parseTimeToMinutes(startTime) + (svcMeta.durationMinutes ?? 60) + addonMins)
      : slotEndFromGrid;
    if (!getEffectiveMobileSlotWindowActive(ops, slotDate, startTime, slotEndFromGrid, capacity)) return { error: 'That window is closed for this date.' };
    const maxC = daySlots.find((s) => s.startTime === startTime && s.endTime === slotEndFromGrid)?.maxConcurrentVehicles ?? capacity;
    const booked = countMobileJobsInWindow(ops.jobs, slotDate, startTime, slotEndFromGrid);
    if (booked >= maxC) return { error: 'That window is full. Pick another time or free a slot.' };
    const eff = getEffectiveMobileSlotState(ops, slotDate, startTime, slotEndFromGrid, capacity);
    const di = activeDrivers.findIndex((d) => d.id === assignedStaffId);
    if (di < 0 || !eff.driversOpen[di]) return { error: 'That driver is not available in this window.' };
    const selectedDriver = activeDrivers[di]!;
    if (!isDriverServiceableForZip(selectedDriver, bookingZip)) return { error: 'Selected driver is not serviceable for this booking zip code.' };
    if (isDriverBusyForWindow(ops.jobs, slotDate, startTime, endTime, assignedStaffId)) return { error: 'That driver is already assigned for this service window.' };
    if (!paymentMethod) return { error: 'Select a payment method.' };
    const today = todayLocalISO();
    if (slotDate < today) return { error: 'Cannot book a past date.' };
    if (slotDate === today && startTime < currentHHMM()) return { error: 'This time slot has already passed today.' };
    return { startTime, slotEndFromGrid, endTime };
  };

  const buildMobileJob = (ctx: { startTime: string; slotEndFromGrid: string; endTime: string }): MobileManagerJob => {
    const name = customerName.trim();
    const addr = composeAddress(address);
    const svcOpt = fullServiceItems.find((o) => o.id === catalogServiceId);
    return {
      id: mobileServicesStoreApi.generateMobileJobId(),
      customerName: name,
      phone: `+61${phone.trim()}`,
      email: email.trim(),
      customerId: customerId,
      vehicleSummary: serviceSummary.trim() || svcOpt?.name || '—',
      address: addr,
      serviceId: catalogServiceId.trim() || null,
      vehicleType: vehicleType.trim() || '—',
      vehicleName: vehicleName.trim(),
      registrationNumber: registrationNumber.trim(),
      slotDate,
      startTime: ctx.startTime,
      endTime: ctx.endTime,
      assignedStaffId: assignedStaffId === 'none' ? null : assignedStaffId,
      status: 'assigned',
      notes: notes.trim(),
      managerNotes: notes.trim(),
      selectedAddonIds: [...selectedAddonIds],
      tipCents,
      serviceChargedCents: Math.round(pricing.subtotal * 100),
      createdAt: new Date().toISOString(),
    };
  };

  const resetMobileForm = () => {
    setCustomerName('');
    setAddress(EMPTY_ADDRESS);
    setAddressErrors({});
    setPhone('');
    setEmail('');
    setCustomerId(null);
    setIsGuestCustomer(false);
    setCustomerVehicles([]);
    setVehicleName('');
    setRegistrationNumber('');
    setSelectedAddonIds([]);
    setTipDollars('');
    setNotes('');
    setAssignedStaffId('none');
    setSlotKey('');
    setPaymentMethod('');
    setSavedAddresses([]);
    setLookupStatus('idle');
    if (fullServiceItems.length) {
      setCatalogServiceId(fullServiceItems[0]!.id);
      setServiceSummary(fullServiceItems[0]!.name);
    }
  };

  const onCreateBookingMobile = async () => {
    setFormError('');
    const v = validateMobile();
    if ('error' in v) {
      setFormError(v.error);
      window.alert(`Validation Error: ${v.error}`);
      return;
    }
    if (paymentMethod === 'card' || paymentMethod === 'apple_pay') {
      setIsProcessing(true);
      await new Promise((res) => setTimeout(res, 1800));
      setIsProcessing(false);
    }
    const job = buildMobileJob(v);
    setIsCreatingBooking(true);
    try {
      await updateMobileOpsForPinAsync(pin, (prev) => ({ ...prev, jobs: [...prev.jobs, job] }));
      setLastPaymentMethod(paymentMethod);
      setLastReceipt(job);
      setReceiptOpen(true);
      resetMobileForm();
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

  const inputCls = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25';

  return (
    <div className="min-w-0 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Create Booking</h1>

      <div
        className={cn(
          shell,
          'flex min-h-0 w-full max-w-full flex-col overflow-hidden max-h-[min(88dvh,900px)]',
          'lg:flex-row lg:items-stretch lg:h-[min(700px,calc(100dvh-13.5rem))]',
        )}
      >
        {/* Left: calendar + slot+driver board */}
        <aside
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden border-b border-slate-200/80 bg-slate-50/60 p-3 sm:p-4',
            'min-h-[min(40svh,380px)] lg:min-h-0 lg:w-[38%] lg:min-w-[260px] lg:max-w-[min(42vw,440px)] lg:flex-none lg:border-b-0 lg:border-r'
          )}
        >
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-2.5">
            <CalendarPopover
              slotDate={slotDate}
              resetKey={pin}
              onDateChange={(iso) => {
                setSlotDate(iso);
                setFormError('');
                setSlotKey('');
                setAssignedStaffId('none');
              }}
            />
          </div>
          {daySlots.length === 0 ? (
            <p className="shrink-0 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs text-amber-900">
              No slots — check hours and Configure slot.
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <p className="shrink-0 border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                Tap an available driver under a time slot to schedule (required).
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
                <ul className="divide-y divide-slate-100">
                  {daySlots.map((s, idx) => {
                    const wk = slotWindowKey(s.startTime, s.endTime);
                    const stateForDay = getEffectiveMobileSlotState(ops, slotDate, s.startTime, s.endTime, capacity);
                    const isPast = slotDate === todayLocalISO() && s.startTime < currentHHMM();
                    const booked = countMobileJobsInWindow(ops.jobs, slotDate, s.startTime, s.endTime);
                    const full = booked >= s.maxConcurrentVehicles;
                    const slotSelectable = stateForDay.slotActive && !full && !isPast;

                    // A slot is "selected" if it falls within the full booking window
                    const [selStart] = effectiveSlotKey.split('|');
                    const selFullEnd = selStart ? formatMinutesToHHMM(parseTimeToMinutes(selStart) + bookingDurationMinutes) : '';
                    const selectedSlot = !!(selStart && selFullEnd && s.startTime >= selStart && s.startTime < selFullEnd);
                    // Covered non-start slots are read-only (part of multi-slot booking window but not the anchor)
                    const isCoveredNonStart = selectedSlot && selStart !== s.startTime;

                    return (
                      <li key={wk} className={cn('px-2 py-2 sm:px-3 transition-colors', selectedSlot ? 'bg-blue-50/40' : 'hover:bg-slate-50/50')}>
                        <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="w-5 shrink-0 text-[10px] tabular-nums text-muted-foreground">{idx + 1}</span>
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {s.startTime} – {s.endTime}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {isPast
                              ? '· slot time passed'
                              : !stateForDay.slotActive
                                ? '· window closed'
                                : full
                                  ? '· window full'
                                  : `· ${stateForDay.driversOpen.filter(Boolean).length} driver${stateForDay.driversOpen.filter(Boolean).length !== 1 ? 's' : ''} free`}
                          </span>
                        </div>

                        {!stateForDay.slotActive ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-[11px] text-muted-foreground">
                            Slot inactive for this date
                          </div>
                        ) : full ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-[11px] text-muted-foreground">
                            This window is full.
                          </div>
                        ) : (
                          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(5rem, 1fr))' }}>
                            {stateForDay.driversOpen.map((driverOpen, di) => {
                              const staffMember = activeDrivers[di];
                              const displayName = staffMember
                                ? staffMember.empName?.trim() || staffMember.loginId
                                : `Driver ${di + 1}`;
                              const zipEligible = staffMember ? isDriverServiceableForZip(staffMember, bookingZip) : false;
                              const busyJob = staffMember
                                ? getJobForDriverInWindow(ops.jobs, slotDate, s.startTime, s.endTime, staffMember.id)
                                : undefined;
                              const busy = !!busyJob;
                              const cardSelectable = Boolean(driverOpen && staffMember && zipEligible && !busy && slotSelectable && !isCoveredNonStart);
                              const driverSelected = selectedSlot && Boolean(staffMember && assignedStaffId === staffMember.id);

                              // Busy driver (from another booking): show "Booked" card
                              if (busyJob && !driverSelected) {
                                return (
                                  <div
                                    key={`${wk}-d${di}`}
                                    className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/80 px-1.5 py-2 text-center text-[10px] font-semibold text-slate-400"
                                  >
                                    <span className="line-clamp-2 leading-tight">{displayName}</span>
                                    <span className="text-[9px] font-normal">Booked</span>
                                  </div>
                                );
                              }

                              const cardSelectableFixed = Boolean(driverOpen && staffMember && zipEligible && !busy && slotSelectable);
                              return (
                                <button
                                  key={`${wk}-d${di}`}
                                  type="button"
                                  disabled={!cardSelectableFixed && !driverSelected}
                                  onClick={() => {
                                    if (!staffMember || !cardSelectableFixed) return;
                                    setSlotKey(wk);
                                    setAssignedStaffId(staffMember.id);
                                  }}
                                  className={cn(
                                    'flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 whitespace-normal rounded-lg border-2 px-1.5 py-1.5 text-center text-[10px] font-semibold shadow-sm transition-all',
                                    driverSelected
                                      ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-400/35 ring-offset-1'
                                      : !cardSelectableFixed
                                        ? 'cursor-not-allowed border-dashed border-slate-200 bg-slate-50/70 text-slate-400'
                                        : 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50/50'
                                  )}
                                >
                                  <span className="line-clamp-2 w-full">{displayName}</span>
                                  {!isPast && (
                                    <span className="text-[9px] font-normal opacity-80">
                                      {!driverOpen ? 'Closed' : !zipEligible ? 'ZIP mismatch' : 'Available'}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </aside>

        {/* Right: branch-manager-style form */}
        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white', 'min-h-[min(36svh,400px)] lg:min-h-0')}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 lg:p-6">

            {/* ── 1. Customer Lookup ── */}
            <div className="mb-5 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer Lookup</p>
              <div className="flex gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="mcb-phone-lookup">Phone</Label>
                  <div className="flex min-w-0">
                    <span className="inline-flex shrink-0 items-center px-2.5 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-xs font-medium">+61</span>
                    <input
                      id="mcb-phone-lookup"
                      className="h-10 min-w-0 flex-1 rounded-r-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
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
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="mcb-email-lookup">Email</Label>
                  <input
                    id="mcb-email-lookup"
                    type="email"
                    className={inputCls}
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

            {/* ── 2. Customer & Vehicle Details ── */}
            <div className="mb-5 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer &amp; Vehicle Details</p>
              <div className="grid gap-2">
                <Label htmlFor="mcb-name">Customer name *</Label>
                <input
                  id="mcb-name"
                  className={inputCls}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {customerVehicles.length > 0 && customerId && !isGuestCustomer ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saved vehicle</label>
                    <select
                      className={inputCls}
                      value={vehicleType}
                      onChange={(e) => {
                        const v = customerVehicles.find((x) => x.type === e.target.value);
                        if (!v) return;
                        setVehicleType(v.type ?? '');
                        setVehicleName(v.name ?? '');
                        setRegistrationNumber(v.registration ?? '');
                      }}
                    >
                      {customerVehicles.map((v, i) => (
                        <option key={i} value={v.type ?? ''}>
                          {[v.type, v.name].filter(Boolean).join(' — ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Vehicle name</label>
                      <input type="text" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} placeholder="e.g. Toyota Corolla"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25" />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Registration</label>
                      <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} placeholder="e.g. ABC123"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="mcb-vtype">Vehicle type</Label>
                      {vehicleTypes.length > 0 ? (
                        <select id="mcb-vtype" className={inputCls} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                          {vehicleTypes.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input id="mcb-vtype" className={inputCls} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. SUV" />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mcb-vname">Vehicle name</Label>
                      <input id="mcb-vname" className={inputCls} value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} placeholder="e.g. Toyota Corolla" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mcb-reg">Registration number</Label>
                    <input id="mcb-reg" className={cn(inputCls, 'font-mono')} value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} placeholder="e.g. ABC 123" />
                  </div>
                </div>
              )}
            </div>

            {/* ── 3. Address (via BookingForm) ── */}
            <BookingForm
              customerName={customerName} onCustomerNameChange={setCustomerName}
              email={email} onEmailChange={setEmail}
              phone={phone} onPhoneChange={setPhone}
              address={address} onAddressChange={setAddress}
              vehicleType={vehicleType} onVehicleTypeChange={setVehicleType}
              vehicleName={vehicleName} onVehicleNameChange={setVehicleName}
              registrationNumber={registrationNumber} onRegistrationNumberChange={setRegistrationNumber}
              vehicleTypes={vehicleTypes}
              serviceOptions={[]}
              catalogServiceId={catalogServiceId} onCatalogServiceIdChange={setCatalogServiceId}
              serviceSummary={serviceSummary} onServiceSummaryChange={setServiceSummary}
              assignees={[]} assigneeId="none" onAssigneeIdChange={() => {}} assigneeLabel="Driver"
              savedAddresses={isGuestCustomer ? [] : savedAddresses}
              addressErrors={addressErrors}
              formError=""
              hidePhone hideEmail hideCustomerName hideVehicleDetails hideAssignee hideNotes hideService
            />

            {/* ── 4. Service picker ── */}
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
                        onClick={() => { setCatalogServiceId(svc.id); setServiceSummary(svc.name); }}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                          selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400/30' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'
                        }`}
                      >
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-900 text-sm">{svc.name}</span>
                              {svc.recommended && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">★ Recommended</span>
                              )}
                              {svc.category && (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  svc.category === 'Detailing' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                                }`}>{svc.category}</span>
                              )}
                              {svc.eligibleForLoyaltyPoints && !isGuestCustomer && customerId && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">♦ Loyalty</span>
                              )}
                              {(svc.freeCoffeeCount ?? 0) > 0 && (
                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                  ☕ {svc.freeCoffeeCount} coffee{(svc.freeCoffeeCount ?? 0) > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">{svc.durationMinutes} min</p>
                          </div>
                          <span className={`shrink-0 text-base font-bold ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
                            ${Number(svc.price).toFixed(2)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 5. Add-ons ── */}
            {addonChoices.length > 0 && (
              <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
                <Label className="text-base">Add-ons (+30 min each)</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {addonChoices.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedAddonIds.includes(a.id)} onChange={() => toggleAddon(a.id)} className="h-4 w-4 rounded border-slate-300" />
                      <span>{a.name} <span className="text-muted-foreground">(${Number(a.price).toFixed(2)})</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── 6. Notes ── */}
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
              <Label className="text-base">Notes (optional)</Label>
              <input
                type="text"
                id="mcb-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputCls}
                placeholder="Any special instructions for the driver…"
              />
            </div>

            {/* ── 7. Driver Assignment ── */}
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
              <Label className="text-base">Driver assignment</Label>
              {!slotKey ? (
                <p className="text-sm text-amber-800">Select a time slot and driver on the calendar first.</p>
              ) : driversForSlot.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drivers available for this slot.</p>
              ) : (
                <select
                  className={inputCls}
                  value={assignedStaffId}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'none') {
                      setAssignedStaffId('none');
                      return;
                    }
                    setAssignedStaffId(next);
                  }}
                  required
                >
                  <option value="none" disabled>
                    Select a driver
                  </option>
                  {driversForSlot.map((d) => (
                    <option key={d.id} value={d.id}>{d.empName?.trim() || d.loginId}</option>
                  ))}
                </select>
              )}
            </div>

            {/* ── 8. Tip ── */}
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
              <Label htmlFor="mcb-tip" className="text-base">Tip (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">$</span>
                <input id="mcb-tip" type="number" min="0" step="1" placeholder="0.00" value={tipDollars}
                  onChange={(e) => setTipDollars(e.target.value)}
                  className="h-10 w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25" />
              </div>
            </div>

            {/* ── 9. Payment ── */}
            <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-bold text-slate-900">Payment Selection</Label>
                {pricing && (
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Amount</p>
                    <p className="text-2xl font-black text-indigo-600">${(pricing.totalCents / 100).toFixed(2)}</p>
                  </div>
                )}
              </div>
              <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />
              {pricing && (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>Service price (inc GST)</span><span>${pricing.servicePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>Add-ons (inc GST)</span><span>${pricing.addonsTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>Tip</span><span>${(tipCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200/80 mt-2 pt-2">
                    <span>Total due</span><span>${(pricing.totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="default"
              className="min-w-[14rem] h-12 rounded-xl font-bold text-base shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-1px] active:translate-y-[0px] disabled:opacity-70 disabled:cursor-not-allowed"
              onClick={onCreateBookingMobile}
              disabled={
                !hasBookableSlot ||
                !slotKey ||
                assignedStaffId === 'none' ||
                isProcessing ||
                isCreatingBooking ||
                !paymentMethod
              }
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing Payment...</>
              ) : isCreatingBooking ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating booking...</>
              ) : (
                'Confirm & Create Booking'
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
          {lastReceipt ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">Booking #</span>
                <span className="font-mono font-semibold">
                  {(() => {
                    const hex = lastReceipt.id.replace(/-/g, '').slice(-6).toUpperCase();
                    if (lastReceipt.customerId) {
                      return `#${hex}-${String(lastReceipt.customerId).replace(/-/g, '').slice(-4).toUpperCase()}`;
                    }
                    const digits = (lastReceipt.phone ?? '').replace(/\D/g, '');
                    if (digits) {
                      const num = parseInt(digits.slice(-9), 10);
                      return `#${hex}-${num.toString(36).toUpperCase().slice(-4).padStart(4, '0')}`;
                    }
                    return `#${hex}`;
                  })()}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">Status</span>
                <span>{mobileJobStatusLabel(lastReceipt.status)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">Date &amp; time</span>
                <span className="text-right">{lastReceipt.slotDate} {lastReceipt.startTime}–{lastReceipt.endTime}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">Service</span>
                <span className="text-right">{lastReceipt.vehicleSummary}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="shrink-0 text-muted-foreground">Payment</span>
                <span>
                  {lastPaymentMethod === 'pay_after' ? 'Pay after service' : lastPaymentMethod === 'card' ? 'Credit / Debit Card' : lastPaymentMethod === 'apple_pay' ? 'Apple Pay' : '—'}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
