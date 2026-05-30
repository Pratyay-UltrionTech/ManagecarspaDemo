import { useMemo, useState } from 'react';
import { useMobileServicesStore } from '../hooks/useMobileServicesStore';
import {
  mobileServicesStoreApi,
  type MobileServiceManager,
  type MobileServiceStaff,
  isValidPinCode,
  normalizePinCode,
} from '../lib/mobileServicesStore';
import { SegmentedPillTabs } from './SegmentedPillTabs';
import { PersonnelDataTable, PersonnelTableRow } from './PersonnelDataTable';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';
import { TableCell } from './ui/table';
import { Separator } from './ui/separator';
import { Clock, Eye, EyeOff, Pencil, Save, Trash2 } from 'lucide-react';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

function parseZipList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((z) => z.trim())
    .filter(Boolean);
}

const emptyManagerForm = () => ({
  pinCode: '',
  empName: '',
  address: '',
  zipCode: '',
  email: '',
  mobile: '',
  doj: '',
  loginId: '',
  password: '',
  confirmPassword: '',
  active: true,
});

function staffManagerLabel(
  cityPin: string,
  managersByPin: Record<string, MobileServiceManager>
): string {
  const pin = normalizePinCode(cityPin);
  const m = managersByPin[pin];
  return m ? `${m.empName} — ${pin}` : pin;
}

const emptyStaffForm = () => ({
  cityPinCode: '',
  servicePinCode: '',
  empName: '',
  address: '',
  zipCode: '',
  serviceableZipsText: '',
  email: '',
  mobile: '',
  doj: '',
  loginId: '',
  password: '',
  confirmPassword: '',
  active: true,
});

export function MobileServicesTeamTab() {
  const { confirm, dialog } = useConfirmDialog();
  const {
    managersByPin,
    managersList,
    cityPins,
    staff,
    mobileOpsByPin,
    upsertManager,
    upsertStaff,
    deleteMobileManager,
    deleteMobileStaff,
    deletePendingByKey,
    deleteErrorByKey,
    updateMobileOpsForPinAsync,
  } = useMobileServicesStore();

  const [teamSegment, setTeamSegment] = useState<'manager' | 'staff' | 'hours'>('manager');

  // Operating hours state: local edits keyed by pin
  const [hoursEdits, setHoursEdits] = useState<Record<string, { openTime: string; closeTime: string }>>({});
  const [hoursSaving, setHoursSaving] = useState<Record<string, boolean>>({});
  const [hoursSaved, setHoursSaved] = useState<Record<string, boolean>>({});
  const [hoursError, setHoursError] = useState<Record<string, string>>({});
  const [managerTab, setManagerTab] = useState(emptyManagerForm);
  const [editingManagerPin, setEditingManagerPin] = useState<string | null>(null);
  const [managerFormError, setManagerFormError] = useState<string | null>(null);

  const [staffTab, setStaffTab] = useState(emptyStaffForm);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [showStaffPw, setShowStaffPw] = useState(false);

  // NEW: validation states
  const [managerErrors, setManagerErrors] = useState<Record<string, string>>({});
  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});

  const validateManagerField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'empName':
        if (!value.trim()) error = 'Name is required';
        else if (!/^[a-zA-Z\s]+$/.test(value)) error = 'Only letters and spaces allowed';
        else if (value.trim().length < 3) error = 'Minimum 3 characters required';
        break;
      case 'address':
        if (!value.trim()) error = 'Address is required';
        else if (value.trim().length < 10) error = 'Minimum 10 characters required';
        break;
      case 'zipCode':
        if (!/^\d{4,6}$/.test(value)) error = 'Must be 4-6 digits';
        break;
      case 'email':
        if (!value.trim()) error = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email format';
        break;
      case 'mobile':
        if (!/^\d{9}$/.test(value)) error = 'Must be exactly 9 digits';
        break;
      case 'doj':
        if (!value) error = 'Date of joining is required';
        else if (new Date(value) > new Date()) error = 'Date cannot be in the future';
        break;
      case 'loginId':
        if (!value.trim()) error = 'Login ID is required';
        else if (value.includes(' ')) error = 'Spaces are not allowed';
        else if (value.trim().length < 4) error = 'Minimum 4 characters required';
        break;
      case 'password':
        if (!value && !editingManagerPin) error = 'Password is required';
        else if (value && (value.length < 6 || !/[A-Z]/.test(value) || !/\d/.test(value)))
          error = 'Min 6 chars, 1 uppercase, 1 number';
        break;
    }
    setManagerErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const validateStaffField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'cityPinCode':
        if (!value) error = 'Manager selection is required';
        break;
      case 'empName':
        if (!value.trim()) error = 'Name is required';
        else if (!/^[a-zA-Z\s]+$/.test(value)) error = 'Only letters and spaces allowed';
        else if (value.trim().length < 3) error = 'Minimum 3 characters required';
        break;
      case 'address':
        if (!value.trim()) error = 'Address is required';
        else if (value.trim().length < 10) error = 'Minimum 10 characters required';
        break;
      case 'zipCode':
        if (!/^\d{4,6}$/.test(value)) error = 'Must be 4-6 digits';
        break;
      case 'serviceableZipsText':
        if (!value.trim()) {
          error = 'Serviceable zip codes are required';
        } else {
          const zips = value.split(/[\n,]+/).map(z => z.trim()).filter(Boolean);
          if (zips.length === 0) error = 'At least one zip code is required';
          else if (zips.some(z => !/^\d{4,6}$/.test(z))) error = 'All codes must be 4-6 digits';
        }
        break;
      case 'email':
        if (!value.trim()) error = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email format';
        break;
      case 'mobile':
        if (!/^\d{9}$/.test(value)) error = 'Must be exactly 9 digits';
        break;
      case 'doj':
        if (!value) error = 'Date of joining is required';
        else if (new Date(value) > new Date()) error = 'Date cannot be in the future';
        break;
      case 'loginId':
        if (!value.trim()) error = 'Login ID is required';
        else if (value.includes(' ')) error = 'Spaces are not allowed';
        else if (value.trim().length < 4) error = 'Minimum 4 characters required';
        break;
      case 'password':
        if (!value && !editingStaffId) error = 'Password is required';
        else if (value && (value.length < 6 || !/[A-Z]/.test(value) || !/\d/.test(value)))
          error = 'Min 6 chars, 1 uppercase, 1 number';
        break;
      case 'confirmPassword':
        if (staffTab.password && value !== staffTab.password) error = 'Passwords do not match';
        break;
    }
    setStaffErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleManagerBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    validateManagerField(e.target.id.replace('mgr-', ''), e.target.value);
  };

  const handleStaffBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    validateStaffField(e.target.id.replace('staff-', ''), e.target.value);
  };

  const resetManagerForm = () => {
    setManagerTab(emptyManagerForm());
    setEditingManagerPin(null);
    setManagerFormError(null);
    setManagerErrors({});
  };

  const resetStaffForm = () => {
    setStaffTab(emptyStaffForm());
    setEditingStaffId(null);
    setStaffFormError(null);
    setStaffErrors({});
  };

  const handleSaveManager = () => {
    setManagerFormError(null);
    // NEW: validate all fields on submit
    const fields = ['empName', 'address', 'zipCode', 'email', 'mobile', 'doj', 'loginId', 'password'];
    let firstErrorField = '';
    let hasError = false;

    fields.forEach((f) => {
      const err = validateManagerField(f, (managerTab as any)[f]);
      if (err && !firstErrorField) firstErrorField = `mgr-${f}`;
      if (err) hasError = true;
    });

    if (hasError) {
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const pin = normalizePinCode(managerTab.pinCode || managerTab.zipCode);
    if (!isValidPinCode(pin)) {
      setManagerFormError('Enter a valid zip/postal PIN: 4-6 digits.');
      return;
    }

    const cleanPhone = managerTab.mobile.replace(/\D/g, '');
    const normalizedEmail = managerTab.email.trim().toLowerCase();
    const normalizedLogin = managerTab.loginId.trim().toLowerCase();

    const duplicateManagerIdentity = managersList.find((m) => {
      if (editingManagerPin && m.pinCode === editingManagerPin) return false;
      const managerPhone = m.mobile.replace(/\D/g, '');
      return (
        (normalizedEmail && m.email.trim().toLowerCase() === normalizedEmail) ||
        (cleanPhone && managerPhone === cleanPhone) ||
        (normalizedLogin && m.loginId.trim().toLowerCase() === normalizedLogin)
      );
    });
    const duplicateStaffIdentity = staff.find((s) => {
      const staffPhone = s.mobile.replace(/\D/g, '');
      return (
        (normalizedEmail && s.email.trim().toLowerCase() === normalizedEmail) ||
        (cleanPhone && staffPhone === cleanPhone) ||
        (normalizedLogin && s.loginId.trim().toLowerCase() === normalizedLogin)
      );
    });
    const duplicateIdentity = duplicateManagerIdentity || duplicateStaffIdentity;
    if (duplicateIdentity) {
      if (normalizedEmail && duplicateIdentity.email.trim().toLowerCase() === normalizedEmail) {
        setManagerErrors((prev) => ({ ...prev, email: 'Email already used' }));
      }
      if (cleanPhone && duplicateIdentity.mobile.replace(/\D/g, '') === cleanPhone) {
        setManagerErrors((prev) => ({ ...prev, mobile: 'Phone already used' }));
      }
      if (normalizedLogin && duplicateIdentity.loginId.trim().toLowerCase() === normalizedLogin) {
        setManagerErrors((prev) => ({ ...prev, loginId: 'Login ID already used' }));
      }
      return;
    }

    const existing = managersByPin[pin];
    if (editingManagerPin === null && existing) {
      setManagerFormError(
        'A manager is already assigned to this PIN. Edit that record or choose another PIN.'
      );
      return;
    }
    if (editingManagerPin !== null && editingManagerPin !== pin && managersByPin[pin]) {
      setManagerFormError('Another manager already uses this PIN.');
      return;
    }

    const manager: MobileServiceManager = {
      pinCode: pin,
      empName: managerTab.empName.trim(),
      address: managerTab.address.trim(),
      zipCode: managerTab.zipCode.trim(),
      email: managerTab.email.trim(),
      mobile: `+61${cleanPhone}`,
      doj: managerTab.doj.trim(),
      loginId: managerTab.loginId.trim(),
      password: managerTab.password.trim(),
      active: managerTab.active,
    };
    upsertManager(manager, editingManagerPin);
    resetManagerForm();
  };

  const startEditManager = (m: MobileServiceManager) => {
    setEditingManagerPin(m.pinCode);
    setManagerTab({
      pinCode: m.pinCode,
      empName: m.empName,
      address: m.address,
      zipCode: m.zipCode,
      email: m.email,
      mobile: m.mobile.startsWith('+61') ? m.mobile.slice(3) : m.mobile,
      doj: m.doj,
      loginId: m.loginId,
      password: '',
      confirmPassword: '',
      active: m.active,
    });
    setManagerErrors({});
    setManagerFormError(null);
  };

  const toggleManagerActive = (m: MobileServiceManager, active: boolean) => {
    upsertManager({ ...m, active }, m.pinCode);
  };

  const handleDeleteManager = async (m: MobileServiceManager) => {
    const ok = await confirm({
      title: 'Delete mobile manager?',
      description: `Remove mobile manager for PIN ${m.pinCode}? All drivers (mobile staff) under this manager will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    if (editingManagerPin === m.pinCode) resetManagerForm();
    if (!m.id) return;
    await deleteMobileManager(m.id).catch(() => {});
  };

  const handleSaveStaff = () => {
    setStaffFormError(null);
    // NEW: validate all fields on submit
    const fields = ['cityPinCode', 'empName', 'address', 'zipCode', 'serviceableZipsText', 'email', 'mobile', 'doj', 'loginId', 'password', 'confirmPassword'];
    let firstErrorField = '';
    let hasError = false;

    fields.forEach((f) => {
      const err = validateStaffField(f, (staffTab as any)[f]);
      if (err && !firstErrorField) firstErrorField = `staff-${f}`;
      if (err) hasError = true;
    });

    if (hasError) {
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const city = normalizePinCode(staffTab.cityPinCode);
    const svc = normalizePinCode(staffTab.servicePinCode || city);
    if (cityPins.length === 0) {
      setStaffFormError('Add at least one mobile manager first, then assign drivers under them.');
      return;
    }
    if (!isValidPinCode(city)) {
      setStaffFormError('Select a manager from the list.');
      return;
    }
    if (!managersByPin[city]) {
      setStaffFormError('That manager is no longer in the list. Pick another manager or add them again.');
      return;
    }
    if (!isValidPinCode(svc)) {
      setStaffFormError('Enter a valid service PIN: 4 digits.');
      return;
    }

    const cleanPhone = staffTab.mobile.replace(/\D/g, '');
    const serviceableZipCodes = parseZipList(staffTab.serviceableZipsText);
    const normalizedEmail = staffTab.email.trim().toLowerCase();
    const normalizedLogin = staffTab.loginId.trim().toLowerCase();

    const duplicateManagerIdentity = managersList.find((m) => {
      const managerPhone = m.mobile.replace(/\D/g, '');
      return (
        (normalizedEmail && m.email.trim().toLowerCase() === normalizedEmail) ||
        (cleanPhone && managerPhone === cleanPhone) ||
        (normalizedLogin && m.loginId.trim().toLowerCase() === normalizedLogin)
      );
    });
    const duplicateStaffIdentity = staff.find((s) => {
      if (editingStaffId && s.id === editingStaffId) return false;
      const staffPhone = s.mobile.replace(/\D/g, '');
      return (
        (normalizedEmail && s.email.trim().toLowerCase() === normalizedEmail) ||
        (cleanPhone && staffPhone === cleanPhone) ||
        (normalizedLogin && s.loginId.trim().toLowerCase() === normalizedLogin)
      );
    });
    const duplicateIdentity = duplicateManagerIdentity || duplicateStaffIdentity;
    if (duplicateIdentity) {
      if (normalizedEmail && duplicateIdentity.email.trim().toLowerCase() === normalizedEmail) {
        setStaffErrors((prev) => ({ ...prev, email: 'Email already used' }));
      }
      if (cleanPhone && duplicateIdentity.mobile.replace(/\D/g, '') === cleanPhone) {
        setStaffErrors((prev) => ({ ...prev, mobile: 'Phone already used' }));
      }
      if (normalizedLogin && duplicateIdentity.loginId.trim().toLowerCase() === normalizedLogin) {
        setStaffErrors((prev) => ({ ...prev, loginId: 'Login ID already used' }));
      }
      return;
    }

    const member: MobileServiceStaff = {
      id: editingStaffId ?? mobileServicesStoreApi.generateStaffId(),
      cityPinCode: city,
      servicePinCode: svc,
      empName: staffTab.empName.trim(),
      address: staffTab.address.trim(),
      zipCode: staffTab.zipCode.trim(),
      serviceableZipCodes,
      email: staffTab.email.trim(),
      mobile: `+61${cleanPhone}`,
      doj: staffTab.doj.trim(),
      loginId: staffTab.loginId.trim(),
      password: staffTab.password.trim(),
      active: staffTab.active,
    };
    upsertStaff(member);
    resetStaffForm();
  };

  const startEditStaff = (s: MobileServiceStaff) => {
    setEditingStaffId(s.id);
    setShowStaffPw(false);
    setStaffTab({
      cityPinCode: s.cityPinCode,
      servicePinCode: s.servicePinCode,
      empName: s.empName,
      address: s.address,
      zipCode: s.zipCode,
      serviceableZipsText: s.serviceableZipCodes.join('\n'),
      email: s.email,
      mobile: s.mobile.startsWith('+61') ? s.mobile.slice(3) : s.mobile,
      doj: s.doj,
      loginId: s.loginId,
      password: '',
      confirmPassword: '',
      active: s.active,
    });
    setStaffErrors({});
    setStaffFormError(null);
  };

  const toggleStaffActive = (s: MobileServiceStaff, active: boolean) => {
    upsertStaff({ ...s, active });
  };

  const handleDeleteStaff = async (s: MobileServiceStaff) => {
    const ok = await confirm({
      title: 'Delete mobile staff?',
      description: `Remove mobile staff "${s.empName}"?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    if (editingStaffId === s.id) resetStaffForm();
    await deleteMobileStaff(s.id).catch(() => {});
  };

  const staffByManager = useMemo(() => {
    const map = new Map<string, MobileServiceStaff[]>();
    for (const s of staff) {
      const pin = normalizePinCode(s.cityPinCode);
      const list = map.get(pin) ?? [];
      list.push(s);
      map.set(pin, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const bySvc = a.servicePinCode.localeCompare(b.servicePinCode);
        if (bySvc !== 0) return bySvc;
        return a.empName.localeCompare(b.empName);
      });
    }
    const pins = [...map.keys()].sort((a, b) => a.localeCompare(b));
    return pins.map((pin) => ({
      pin,
      manager: managersByPin[pin] ?? null,
      members: map.get(pin)!,
    }));
  }, [staff, managersByPin]);

  const managerColumns = [
    { key: 'name', header: 'Name', headerClassName: 'w-[9rem]' },
    { key: 'address', header: 'Address', headerClassName: 'min-w-0' },
    { key: 'zip', header: 'Zip', headerClassName: 'w-[4.5rem]' },
    { key: 'email', header: 'Email', headerClassName: 'min-w-0 w-[22%]' },
    { key: 'active', header: 'Active', headerClassName: 'w-[4.25rem] text-center' },
    { key: 'actions', header: 'Actions', headerClassName: 'w-[168px] text-right' },
  ];

  /** Driver rows only — manager is shown in the section header above each table. */
  const driverColumns = [
    { key: 'name', header: 'Driver', headerClassName: 'w-[7rem]' },
    { key: 'address', header: 'Address', headerClassName: 'min-w-0 w-[26%]' },
    { key: 'zip', header: 'Zip', headerClassName: 'w-[4.5rem]' },
    { key: 'svcZips', header: 'Serviceable zips', headerClassName: 'min-w-0 w-[22%]' },
    { key: 'email', header: 'Email', headerClassName: 'min-w-0 w-[18%]' },
    { key: 'active', header: 'Active', headerClassName: 'w-[4.25rem] text-center' },
    { key: 'actions', header: 'Actions', headerClassName: 'w-[168px] text-right' },
  ];

  return (
    <div className="space-y-6">
      {dialog}

      <div className="space-y-5">
        <SegmentedPillTabs
          value={teamSegment}
          onValueChange={(v) => setTeamSegment(v as 'manager' | 'staff' | 'hours')}
          aria-label="Mobile manager or staff"
          options={[
            { value: 'manager', label: 'Mobile manager' },
            { value: 'staff', label: 'Mobile staff' },
            { value: 'hours', label: 'Operating hours' },
          ]}
        />

        {teamSegment === 'hours' ? (
          <div className="space-y-6">
            {cityPins.length === 0 ? (
              <div className="rounded-xl border border-blue-100/80 bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-sm">
                Add at least one mobile manager first — operating hours are configured per city PIN.
              </div>
            ) : (
              <div className="space-y-4">
                {cityPins.map((pin) => {
                  const stored = mobileOpsByPin[pin] ?? { openTime: '08:00', closeTime: '18:00' };
                  const edit = hoursEdits[pin] ?? { openTime: stored.openTime, closeTime: stored.closeTime };
                  const saving = hoursSaving[pin] ?? false;
                  const saved = hoursSaved[pin] ?? false;
                  const error = hoursError[pin] ?? '';

                  const setEdit = (field: 'openTime' | 'closeTime', val: string) => {
                    setHoursEdits((prev) => ({ ...prev, [pin]: { ...edit, [field]: val } }));
                    setHoursSaved((prev) => ({ ...prev, [pin]: false }));
                    setHoursError((prev) => ({ ...prev, [pin]: '' }));
                  };

                  const handleSaveHours = async () => {
                    if (!edit.openTime || !edit.closeTime) {
                      setHoursError((prev) => ({ ...prev, [pin]: 'Both open and close time are required.' }));
                      return;
                    }
                    if (edit.openTime >= edit.closeTime) {
                      setHoursError((prev) => ({ ...prev, [pin]: 'Close time must be after open time.' }));
                      return;
                    }
                    setHoursSaving((prev) => ({ ...prev, [pin]: true }));
                    setHoursError((prev) => ({ ...prev, [pin]: '' }));
                    try {
                      await updateMobileOpsForPinAsync(pin, (prev) => ({
                        ...prev,
                        openTime: edit.openTime,
                        closeTime: edit.closeTime,
                      }));
                      setHoursSaved((prev) => ({ ...prev, [pin]: true }));
                      setHoursEdits((prev) => { const n = { ...prev }; delete n[pin]; return n; });
                    } catch (err: unknown) {
                      setHoursError((prev) => ({
                        ...prev,
                        [pin]: err instanceof Error ? err.message : 'Failed to save. Try again.',
                      }));
                    } finally {
                      setHoursSaving((prev) => ({ ...prev, [pin]: false }));
                    }
                  };

                  return (
                    <Card key={pin}>
                      <CardHeader className="border-b border-border pb-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Clock className="size-4 text-muted-foreground" />
                              City PIN: {pin}
                            </CardTitle>
                          </div>
                          {saved && (
                            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Saved
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5">
                        {error ? (
                          <p className="mb-3 text-sm font-medium text-destructive">{error}</p>
                        ) : null}
                        <div className="grid gap-4 sm:grid-cols-2 sm:max-w-sm">
                          <div className="space-y-2">
                            <Label htmlFor={`hours-open-${pin}`}>Open time</Label>
                            <Input
                              id={`hours-open-${pin}`}
                              type="time"
                              value={edit.openTime}
                              onChange={(e) => setEdit('openTime', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`hours-close-${pin}`}>Close time</Label>
                            <Input
                              id={`hours-close-${pin}`}
                              type="time"
                              value={edit.closeTime}
                              onChange={(e) => setEdit('closeTime', e.target.value)}
                            />
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="border-t border-border bg-muted/30 px-6 py-4">
                        <Button
                          type="button"
                          disabled={saving}
                          onClick={handleSaveHours}
                        >
                          <Save className="mr-2 size-4" />
                          {saving ? 'Saving…' : 'Save hours'}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : teamSegment === 'manager' ? (
          <div className="space-y-8">
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle>{editingManagerPin ? 'Edit mobile manager' : 'New mobile manager'}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {managerFormError ? (
                  <p className="mb-4 text-sm font-medium text-destructive">{managerFormError}</p>
                ) : null}
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mgr-empName">Employee name</Label>
                    <Input
                      id="mgr-empName"
                      value={managerTab.empName}
                      onChange={(e) => {
                        setManagerTab((f) => ({ ...f, empName: e.target.value }));
                        if (managerErrors.empName) validateManagerField('empName', e.target.value);
                      }}
                      onBlur={handleManagerBlur}
                      className={managerErrors.empName ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      autoComplete="name"
                    />
                    {managerErrors.empName && <p className="text-xs font-medium text-destructive">{managerErrors.empName}</p>}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="mgr-address">Address</Label>
                    <Textarea
                      id="mgr-address"
                      rows={3}
                      value={managerTab.address}
                      onChange={(e) => {
                        setManagerTab((f) => ({ ...f, address: e.target.value }));
                        if (managerErrors.address) validateManagerField('address', e.target.value);
                      }}
                      onBlur={handleManagerBlur}
                      className={managerErrors.address ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      placeholder="Street, building, area…"
                    />
                    {managerErrors.address && <p className="text-xs font-medium text-destructive">{managerErrors.address}</p>}
                  </div>
                  <div className="space-y-2 sm:max-w-xs">
                    <Label htmlFor="mgr-zipCode">Zip / postal code</Label>
                    <Input
                      id="mgr-zipCode"
                      value={managerTab.zipCode}
                      maxLength={6}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setManagerTab((f) => ({ ...f, zipCode: val, pinCode: normalizePinCode(val) }));
                        validateManagerField('zipCode', val);
                      }}
                      onBlur={handleManagerBlur}
                      className={managerErrors.zipCode ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                    />
                    {managerErrors.zipCode && <p className="text-xs font-medium text-destructive">{managerErrors.zipCode}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mgr-email">Email</Label>
                    <Input
                      id="mgr-email"
                      type="email"
                      value={managerTab.email}
                      onChange={(e) => {
                        setManagerTab((f) => ({ ...f, email: e.target.value }));
                        if (managerErrors.email) validateManagerField('email', e.target.value);
                      }}
                      onBlur={handleManagerBlur}
                      className={managerErrors.email ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      autoComplete="email"
                    />
                    {managerErrors.email && <p className="text-xs font-medium text-destructive">{managerErrors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mgr-mobile">Mobile</Label>
                    <div className="flex flex-col">
                      <div className="flex">
                        <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-500 font-mono">
                          +61
                        </span>
                        <Input
                          id="mgr-mobile"
                          value={managerTab.mobile}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                            setManagerTab((f) => ({ ...f, mobile: val }));
                            validateManagerField('mobile', val);
                          }}
                          onBlur={handleManagerBlur}
                          className={`rounded-l-none font-mono ${managerErrors.mobile ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                          placeholder="4XXXXXXXX"
                          autoComplete="tel"
                        />
                      </div>
                      {managerErrors.mobile && <p className="mt-1 text-xs font-medium text-destructive">{managerErrors.mobile}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mgr-doj">Date of joining</Label>
                    <Input
                      id="mgr-doj"
                      type="date"
                      value={managerTab.doj}
                      onChange={(e) => {
                        setManagerTab((f) => ({ ...f, doj: e.target.value }));
                        validateManagerField('doj', e.target.value);
                      }}
                      onBlur={handleManagerBlur}
                      className={managerErrors.doj ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                    />
                    {managerErrors.doj && <p className="text-xs font-medium text-destructive">{managerErrors.doj}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mgr-loginId">Login ID</Label>
                    <Input
                      id="mgr-loginId"
                      value={managerTab.loginId}
                      onChange={(e) => {
                        setManagerTab((f) => ({ ...f, loginId: e.target.value }));
                        if (managerErrors.loginId) validateManagerField('loginId', e.target.value);
                      }}
                      onBlur={handleManagerBlur}
                      className={managerErrors.loginId ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      autoComplete="username"
                    />
                    {managerErrors.loginId && <p className="text-xs font-medium text-destructive">{managerErrors.loginId}</p>}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="mgr-password">Password</Label>
                    <Input
                      id="mgr-password"
                      type="password"
                      value={managerTab.password}
                      onChange={(e) => {
                        setManagerTab((f) => ({ ...f, password: e.target.value }));
                        if (managerErrors.password) validateManagerField('password', e.target.value);
                      }}
                      onBlur={handleManagerBlur}
                      className={managerErrors.password ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      autoComplete="new-password"
                    />
                    {managerErrors.password && <p className="text-xs font-medium text-destructive">{managerErrors.password}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-100/80 bg-slate-50/50 px-4 py-3 sm:col-span-2 sm:max-w-md">
                    <div>
                      <p className="text-sm font-medium text-foreground">Active</p>
                      <p className="text-xs text-muted-foreground">Inactive managers can be hidden from ops views.</p>
                    </div>
                    <Switch
                      checked={managerTab.active}
                      onCheckedChange={(c) => setManagerTab((f) => ({ ...f, active: c === true }))}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-6 py-4">
                <Button
                  type="button"
                  onClick={handleSaveManager}
                  disabled={Object.values(managerErrors).some(x => !!x)}
                >
                  <Save className="mr-2 size-4" />
                  Save manager
                </Button>
                {editingManagerPin ? (
                  <Button type="button" variant="outline" onClick={resetManagerForm}>
                    Cancel edit
                  </Button>
                ) : null}
              </CardFooter>
            </Card>

            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                All mobile managers
              </h3>
              {managersList.length === 0 ? (
                <div className="overflow-x-auto rounded-xl border border-blue-100/80 bg-card shadow-sm">
                  <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No mobile managers yet.
                  </p>
                </div>
              ) : (
                <PersonnelDataTable columns={managerColumns} tableClassName="min-w-[800px]">
                  {managersList.map((m) => (
                    <PersonnelTableRow key={m.pinCode}>
                      <TableCell className="min-w-0 align-top whitespace-normal break-words font-medium text-foreground">
                        {m.empName}
                      </TableCell>
                      <TableCell
                        className="min-w-0 align-top whitespace-normal break-words text-muted-foreground"
                        title={m.address}
                      >
                        {m.address}
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                        {m.zipCode || '—'}
                      </TableCell>
                      <TableCell
                        className="min-w-0 align-top break-all text-muted-foreground"
                        title={m.email}
                      >
                        {m.email}
                      </TableCell>
                      <TableCell className="text-center align-top">
                        <Switch
                          checked={m.active}
                          onCheckedChange={(c) => toggleManagerActive(m, c === true)}
                          aria-label={`Active ${m.empName}`}
                        />
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-blue-700 hover:bg-blue-100/80"
                            onClick={() => startEditManager(m)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={!m.id || deletePendingByKey[`mobile-manager:${m.id}`]}
                            onClick={() => handleDeleteManager(m)}
                          >
                            <Trash2 className="size-4" />
                            {m.id && deletePendingByKey[`mobile-manager:${m.id}`] ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                        {m.id && deleteErrorByKey[`mobile-manager:${m.id}`] ? (
                          <p className="text-xs text-destructive">{deleteErrorByKey[`mobile-manager:${m.id}`]}</p>
                        ) : null}
                      </TableCell>
                    </PersonnelTableRow>
                  ))}
                </PersonnelDataTable>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle>{editingStaffId ? 'Edit mobile staff' : 'New mobile staff'}</CardTitle>
                <CardDescription>
                  Select which mobile manager this driver belongs to (that sets their city PIN). Service PIN is
                  the area PIN. Add one serviceable zip per line (or comma-separated).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {staffFormError ? (
                  <p className="mb-4 text-sm font-medium text-destructive">{staffFormError}</p>
                ) : null}
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="staff-cityPinCode">Manager</Label>
                    <p className="text-xs text-muted-foreground">
                      Drivers are grouped under the manager you select; the manager&apos;s city PIN is applied
                      automatically.
                    </p>
                    {cityPins.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Add a mobile manager in the other tab first, then you can assign drivers here.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <Select
                          value={staffTab.cityPinCode || undefined}
                          onValueChange={(v) => {
                            setStaffTab((f) => ({
                              ...f,
                              cityPinCode: v,
                              servicePinCode: normalizePinCode(f.servicePinCode || v),
                            }));
                            validateStaffField('cityPinCode', v);
                          }}
                        >
                          <SelectTrigger
                            id="staff-cityPinCode"
                            className={`w-full max-w-md ${staffErrors.cityPinCode ? 'border-destructive ring-destructive' : ''}`}
                          >
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                          <SelectContent>
                            {cityPins.map((p) => (
                              <SelectItem key={p} value={p}>
                                {staffManagerLabel(p, managersByPin)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {staffErrors.cityPinCode && <p className="text-xs font-medium text-destructive">{staffErrors.cityPinCode}</p>}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-empName">Employee name</Label>
                    <Input
                      id="staff-empName"
                      value={staffTab.empName}
                      onChange={(e) => {
                        setStaffTab((f) => ({ ...f, empName: e.target.value }));
                        if (staffErrors.empName) validateStaffField('empName', e.target.value);
                      }}
                      onBlur={handleStaffBlur}
                      className={staffErrors.empName ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      autoComplete="name"
                    />
                    {staffErrors.empName && <p className="text-xs font-medium text-destructive">{staffErrors.empName}</p>}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="staff-address">Address</Label>
                    <Textarea
                      id="staff-address"
                      rows={3}
                      value={staffTab.address}
                      onChange={(e) => {
                        setStaffTab((f) => ({ ...f, address: e.target.value }));
                        if (staffErrors.address) validateStaffField('address', e.target.value);
                      }}
                      onBlur={handleStaffBlur}
                      className={staffErrors.address ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      placeholder="Street, building, area…"
                    />
                    {staffErrors.address && <p className="text-xs font-medium text-destructive">{staffErrors.address}</p>}
                  </div>
                  <div className="space-y-2 sm:max-w-xs">
                    <Label htmlFor="staff-zipCode">Zip / postal code</Label>
                    <Input
                      id="staff-zipCode"
                      value={staffTab.zipCode}
                      maxLength={6}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setStaffTab((f) => ({ ...f, zipCode: val }));
                        validateStaffField('zipCode', val);
                      }}
                      onBlur={handleStaffBlur}
                      className={staffErrors.zipCode ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                    />
                    {staffErrors.zipCode && <p className="text-xs font-medium text-destructive">{staffErrors.zipCode}</p>}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="staff-serviceableZipsText">Serviceable zip codes</Label>
                    <Textarea
                      id="staff-serviceableZipsText"
                      rows={3}
                      value={staffTab.serviceableZipsText}
                      onChange={(e) => {
                        setStaffTab((f) => ({ ...f, serviceableZipsText: e.target.value }));
                        if (staffErrors.serviceableZipsText) validateStaffField('serviceableZipsText', e.target.value);
                      }}
                      onBlur={handleStaffBlur}
                      className={staffErrors.serviceableZipsText ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      placeholder={'One per line or comma-separated\ne.g. 2000, 2001'}
                    />
                    {staffErrors.serviceableZipsText && <p className="text-xs font-medium text-destructive">{staffErrors.serviceableZipsText}</p>}
                  </div>
                  <Separator className="sm:col-span-2" />
                  <div className="space-y-2">
                    <Label htmlFor="staff-email">Email</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      value={staffTab.email}
                      onChange={(e) => {
                        setStaffTab((f) => ({ ...f, email: e.target.value }));
                        if (staffErrors.email) validateStaffField('email', e.target.value);
                      }}
                      onBlur={handleStaffBlur}
                      className={staffErrors.email ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      autoComplete="email"
                    />
                    {staffErrors.email && <p className="text-xs font-medium text-destructive">{staffErrors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-mobile">Mobile</Label>
                    <div className="flex flex-col">
                      <div className="flex">
                        <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-500 font-mono">
                          +61
                        </span>
                        <Input
                          id="staff-mobile"
                          value={staffTab.mobile}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                            setStaffTab((f) => ({ ...f, mobile: val }));
                            validateStaffField('mobile', val);
                          }}
                          onBlur={handleStaffBlur}
                          className={`rounded-l-none font-mono ${staffErrors.mobile ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                          placeholder="4XXXXXXXX"
                          autoComplete="tel"
                        />
                      </div>
                      {staffErrors.mobile && <p className="mt-1 text-xs font-medium text-destructive">{staffErrors.mobile}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-doj">Date of joining</Label>
                    <Input
                      id="staff-doj"
                      type="date"
                      value={staffTab.doj}
                      onChange={(e) => {
                        setStaffTab((f) => ({ ...f, doj: e.target.value }));
                        validateStaffField('doj', e.target.value);
                      }}
                      onBlur={handleStaffBlur}
                      className={staffErrors.doj ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                    />
                    {staffErrors.doj && <p className="text-xs font-medium text-destructive">{staffErrors.doj}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-loginId">Login ID</Label>
                    <Input
                      id="staff-loginId"
                      value={staffTab.loginId}
                      onChange={(e) => {
                        setStaffTab((f) => ({ ...f, loginId: e.target.value }));
                        if (staffErrors.loginId) validateStaffField('loginId', e.target.value);
                      }}
                      onBlur={handleStaffBlur}
                      className={staffErrors.loginId ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      autoComplete="username"
                    />
                    {staffErrors.loginId && <p className="text-xs font-medium text-destructive">{staffErrors.loginId}</p>}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="staff-password">
                        {editingStaffId ? 'New password' : 'Password'}
                      </Label>
                      {editingStaffId && (
                        <span className="text-xs text-muted-foreground">Leave blank to keep current password</span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="staff-password"
                        type={showStaffPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={staffTab.password}
                        onChange={(e) => {
                          setStaffTab((f) => ({ ...f, password: e.target.value }));
                          validateStaffField('password', e.target.value);
                          if (staffTab.confirmPassword) validateStaffField('confirmPassword', staffTab.confirmPassword);
                        }}
                        onBlur={handleStaffBlur}
                        className={`pr-10 ${staffErrors.password ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPw((p) => !p)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                      >
                        {showStaffPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {staffErrors.password && <p className="text-xs font-medium text-destructive">{staffErrors.password}</p>}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="staff-confirmPassword">
                      {editingStaffId ? 'Confirm new password' : 'Confirm password'}
                    </Label>
                    <Input
                      id="staff-confirmPassword"
                      type={showStaffPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={staffTab.confirmPassword}
                      onChange={(e) => {
                        setStaffTab((f) => ({ ...f, confirmPassword: e.target.value }));
                        validateStaffField('confirmPassword', e.target.value);
                      }}
                      onBlur={(e) => validateStaffField('confirmPassword', e.target.value)}
                      className={staffErrors.confirmPassword ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      disabled={!staffTab.password}
                    />
                    {staffErrors.confirmPassword && <p className="text-xs font-medium text-destructive">{staffErrors.confirmPassword}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-100/80 bg-slate-50/50 px-4 py-3 sm:col-span-2 sm:max-w-md">
                    <div>
                      <p className="text-sm font-medium text-foreground">Active</p>
                      <p className="text-xs text-muted-foreground">Inactive staff can be hidden from ops views.</p>
                    </div>
                    <Switch
                      checked={staffTab.active}
                      onCheckedChange={(c) => setStaffTab((f) => ({ ...f, active: c === true }))}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-6 py-4">
                <Button
                  type="button"
                  onClick={handleSaveStaff}
                  disabled={cityPins.length === 0 || Object.values(staffErrors).some(x => !!x)}
                >
                  <Save className="mr-2 size-4" />
                  Save staff
                </Button>
                {editingStaffId ? (
                  <Button type="button" variant="outline" onClick={resetStaffForm}>
                    Cancel edit
                  </Button>
                ) : null}
              </CardFooter>
            </Card>

            <div className="space-y-3">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Drivers by manager
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each block lists the manager, then every driver assigned to that manager&apos;s city PIN.
                </p>
              </div>
              {staffByManager.length === 0 ? (
                <div className="overflow-x-auto rounded-xl border border-blue-100/80 bg-card shadow-sm">
                  <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No mobile staff yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {staffByManager.map(({ pin, manager, members }) => (
                    <div
                      key={pin}
                      className="overflow-x-auto rounded-xl border border-blue-100/80 bg-card shadow-sm"
                    >
                      <div className="border-b border-blue-100/80 bg-gradient-to-r from-blue-50/90 to-slate-50/80 px-4 py-3 sm:px-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-950/55">
                          Manager
                        </p>
                        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <p className="text-base font-semibold text-foreground">
                              {manager?.empName ?? 'Unknown manager'}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {members.length} driver{members.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <PersonnelDataTable columns={driverColumns} framed={false} tableClassName="min-w-[920px]">
                          {members.map((s) => {
                            const zipsLine = s.serviceableZipCodes.join(', ') || '—';
                            return (
                            <PersonnelTableRow key={s.id}>
                              <TableCell className="min-w-0 align-top whitespace-normal break-words font-medium text-foreground">
                                {s.empName}
                              </TableCell>
                              <TableCell
                                className="min-w-0 align-top whitespace-normal break-words text-muted-foreground"
                                title={s.address}
                              >
                                {s.address}
                              </TableCell>
                              <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                                {s.zipCode ? s.zipCode : '—'}
                              </TableCell>
                              <TableCell
                                className="min-w-0 align-top whitespace-normal break-words text-muted-foreground"
                                title={zipsLine}
                              >
                                {zipsLine}
                              </TableCell>
                              <TableCell
                                className="min-w-0 align-top break-all text-muted-foreground"
                                title={s.email}
                              >
                                {s.email}
                              </TableCell>
                              <TableCell className="text-center align-top">
                                <Switch
                                  checked={s.active}
                                  onCheckedChange={(c) => toggleStaffActive(s, c === true)}
                                  aria-label={`Active ${s.empName}`}
                                />
                              </TableCell>
                              <TableCell className="text-right align-top whitespace-nowrap">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-700 hover:bg-blue-100/80"
                                    onClick={() => startEditStaff(s)}
                                  >
                                    <Pencil className="size-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10"
                                    disabled={deletePendingByKey[`mobile-staff:${s.id}`]}
                                    onClick={() => handleDeleteStaff(s)}
                                  >
                                    <Trash2 className="size-4" />
                                    {deletePendingByKey[`mobile-staff:${s.id}`] ? 'Deleting...' : 'Delete'}
                                  </Button>
                                </div>
                                {deleteErrorByKey[`mobile-staff:${s.id}`] ? (
                                  <p className="text-xs text-destructive">{deleteErrorByKey[`mobile-staff:${s.id}`]}</p>
                                ) : null}
                              </TableCell>
                            </PersonnelTableRow>
                            );
                          })}
                      </PersonnelDataTable>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
