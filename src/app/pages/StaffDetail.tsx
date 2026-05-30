import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useBranchStore } from '../hooks/useBranchStore';
import { type BranchManager, type Washer } from '../lib/branchStore';
import { ApiRequestError, saveManagerToApi, saveWasherToApi } from '../lib/branchApi';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { SegmentedPillTabs } from '../components/SegmentedPillTabs';
import { PersonnelDataTable, PersonnelTableRow } from '../components/PersonnelDataTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { TableCell } from '../components/ui/table';

const emptyManagerDraft = () => ({
  name: '',
  address: '',
  zipCode: '',
  email: '',
  phone: '',
  doj: '',
  loginId: '',
  password: '',
  confirmPassword: '',
  active: true,
});

export default function StaffDetail() {
  const { confirm, dialog } = useConfirmDialog();
  const { branchId } = useParams<{ branchId: string }>();
  const {
    branches,
    updateBranchData,
    getData,
    deleteBranchManager,
    deleteBranchWasher,
    deletePendingByKey,
    deleteErrorByKey,
  } = useBranchStore();

  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const [staffSegment, setStaffSegment] = useState<'manager' | 'washer'>('manager');
  const [mgrDraft, setMgrDraft] = useState(emptyManagerDraft);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);

  const [washerDraft, setWasherDraft] = useState({
    name: '',
    address: '',
    zipCode: '',
    email: '',
    phone: '',
    doj: '',
    loginId: '',
    password: '',
    confirmPassword: '',
    active: true,
  });
  const [editingWasherId, setEditingWasherId] = useState<string | null>(null);
  const [isSavingManager, setIsSavingManager] = useState(false);
  const [isSavingWasher, setIsSavingWasher] = useState(false);
  const [showMgrPw, setShowMgrPw] = useState(false);
  const [showWasherPw, setShowWasherPw] = useState(false);

  // NEW: validation states
  const [mgrErrors, setMgrErrors] = useState<Record<string, string>>({});
  const [washerErrors, setWasherErrors] = useState<Record<string, string>>({});

  const mapIdentityConflictError = (error: unknown): { field: 'email' | 'phone' | 'loginId'; message: string } | null => {
    if (!(error instanceof ApiRequestError) || error.status !== 409) return null;
    const normalizedField = error.field === 'login_id' ? 'loginId' : error.field;
    if (normalizedField === 'email') return { field: 'email', message: 'Email already registered' };
    if (normalizedField === 'phone') return { field: 'phone', message: 'Phone already registered' };
    if (normalizedField === 'loginId') return { field: 'loginId', message: 'Login ID already registered' };

    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('email')) return { field: 'email', message: 'Email already registered' };
    if (msg.includes('phone') || msg.includes('mobile')) return { field: 'phone', message: 'Phone already registered' };
    if (msg.includes('login')) return { field: 'loginId', message: 'Login ID already registered' };
    return null;
  };

  const findDuplicateStaffIdentity = (
    kind: 'manager' | 'washer',
    candidate: { email: string; phone: string; loginId: string },
    editingId: string | null
  ): { field: 'email' | 'phone' | 'loginId'; message: string } | null => {
    const targetEmail = candidate.email.trim().toLowerCase();
    const targetPhone = candidate.phone.replace(/\D/g, '');
    const targetLoginId = candidate.loginId.trim().toLowerCase();

    for (const b of branches) {
      const bd = getData(b.id);
      for (const m of bd.branchManagers) {
        if (kind === 'manager' && b.id === branchId && m.id === editingId) continue;
        if (targetEmail && String(m.email ?? '').trim().toLowerCase() === targetEmail) {
          return { field: 'email', message: 'Email already registered' };
        }
        if (targetPhone && String(m.phone ?? '').replace(/\D/g, '') === targetPhone) {
          return { field: 'phone', message: 'Phone already registered' };
        }
        if (targetLoginId && String(m.loginId ?? '').trim().toLowerCase() === targetLoginId) {
          return { field: 'loginId', message: 'Login ID already registered' };
        }
      }
      for (const w of bd.washers) {
        if (kind === 'washer' && b.id === branchId && w.id === editingId) continue;
        if (targetEmail && String(w.email ?? '').trim().toLowerCase() === targetEmail) {
          return { field: 'email', message: 'Email already registered' };
        }
        if (targetPhone && String(w.phone ?? '').replace(/\D/g, '') === targetPhone) {
          return { field: 'phone', message: 'Phone already registered' };
        }
        if (targetLoginId && String(w.loginId ?? '').trim().toLowerCase() === targetLoginId) {
          return { field: 'loginId', message: 'Login ID already registered' };
        }
      }
    }
    return null;
  };

  const validateMgrField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'name':
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
      case 'phone':
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
        if (!value && !editingManagerId) error = 'Password is required';
        else if (value && (value.length < 6 || !/[A-Z]/.test(value) || !/\d/.test(value)))
          error = 'Min 6 chars, 1 uppercase, 1 number';
        break;
      case 'confirmPassword':
        if (mgrDraft.password && value !== mgrDraft.password) error = 'Passwords do not match';
        break;
    }
    setMgrErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const validateWasherField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'name':
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
      case 'phone':
        if (value && !/^\d{9}$/.test(value)) error = 'Must be exactly 9 digits';
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
        if (!value && !editingWasherId) error = 'Password is required';
        else if (value && (value.length < 6 || !/[A-Z]/.test(value) || !/\d/.test(value)))
          error = 'Min 6 chars, 1 uppercase, 1 number';
        break;
      case 'confirmPassword':
        if (washerDraft.password && value !== washerDraft.password) error = 'Passwords do not match';
        break;
    }
    setWasherErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleMgrBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    validateMgrField(e.target.id.replace('bm-', ''), e.target.value);
  };

  const handleWasherBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    validateWasherField(e.target.id.replace('washer-', ''), e.target.value);
  };

  useEffect(() => {
    setMgrDraft(emptyManagerDraft());
    setEditingManagerId(null);
    setWasherDraft({
      name: '',
      address: '',
      zipCode: '',
      email: '',
      phone: '',
      doj: '',
      loginId: '',
      password: '',
      confirmPassword: '',
      active: true,
    });
    setEditingWasherId(null);
    setStaffSegment('manager');
    setMgrErrors({});
    setWasherErrors({});
  }, [branchId]);

  if (!branchId || !branch || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-blue-50/30 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Branch not found.</p>
        <Link
          to="/staff"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to branch staff
        </Link>
      </div>
    );
  }

  const resetManagerForm = () => {
    setMgrDraft(emptyManagerDraft());
    setEditingManagerId(null);
    setMgrErrors({});
  };

  const saveBranchManager = async () => {
    // NEW: validate all fields on submit
    const fields = ['name', 'address', 'zipCode', 'email', 'phone', 'doj', 'loginId', 'password', 'confirmPassword'];
    let firstErrorField = '';
    let hasError = false;

    fields.forEach((f) => {
      const err = validateMgrField(f, (mgrDraft as any)[f]);
      if (err && !firstErrorField) firstErrorField = `bm-${f}`;
      if (err) hasError = true;
    });

    if (hasError) {
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const cleanPhone = mgrDraft.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 9) {
      setMgrErrors(prev => ({ ...prev, phone: 'Must be exactly 9 digits' }));
      return;
    }
    const mgrDuplicate = findDuplicateStaffIdentity(
      'manager',
      { email: mgrDraft.email, phone: `+61${cleanPhone}`, loginId: mgrDraft.loginId },
      editingManagerId
    );
    if (mgrDuplicate) {
      setMgrErrors(prev => ({ ...prev, [mgrDuplicate.field]: mgrDuplicate.message }));
      return;
    }
    try {
      setIsSavingManager(true);
      await saveManagerToApi(branchId, {
        id: editingManagerId,
        name: mgrDraft.name.trim(),
        address: mgrDraft.address.trim(),
        zipCode: mgrDraft.zipCode.trim(),
        email: mgrDraft.email.trim(),
        phone: `+61${cleanPhone}`,
        doj: mgrDraft.doj,
        loginId: mgrDraft.loginId.trim(),
        password: mgrDraft.password,
        active: mgrDraft.active,
      });
      updateBranchData(branchId, (d) => d);
      resetManagerForm();
    } catch (error) {
      const conflict = mapIdentityConflictError(error);
      if (conflict) {
        setMgrErrors(prev => ({ ...prev, [conflict.field]: conflict.message }));
        return;
      }
      setMgrErrors(prev => ({ ...prev, loginId: 'Unable to save manager. Please try again.' }));
    } finally {
      setIsSavingManager(false);
    }
  };

  const handleDeleteBranchManager = async (id: string) => {
    const m = data.branchManagers.find((x) => x.id === id);
    const ok = await confirm({
      title: 'Delete branch manager?',
      description: `Remove branch manager "${m?.name ?? id}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await deleteBranchManager(branchId, id).catch(() => {});
    if (editingManagerId === id) resetManagerForm();
  };

  const editBranchManager = (m: BranchManager) => {
    setEditingManagerId(m.id);
    setShowMgrPw(false);
    setMgrDraft({
      name: m.name,
      address: m.address,
      zipCode: m.zipCode,
      email: m.email,
      phone: m.phone.startsWith('+61') ? m.phone.slice(3) : m.phone,
      doj: m.doj,
      loginId: m.loginId,
      password: '',
      confirmPassword: '',
      active: m.active,
    });
    setMgrErrors({});
  };

  const toggleBranchManagerActive = (id: string, active: boolean) => {
    updateBranchData(branchId, (d) => ({
      ...d,
      branchManagers: d.branchManagers.map((m) => (m.id === id ? { ...m, active } : m)),
    }));
  };

  const saveWasher = async () => {
    // NEW: validate all fields on submit
    const fields = ['name', 'address', 'zipCode', 'email', 'phone', 'doj', 'loginId', 'password', 'confirmPassword'];
    let firstErrorField = '';
    let hasError = false;

    fields.forEach((f) => {
      const err = validateWasherField(f, (washerDraft as any)[f]);
      if (err && !firstErrorField) firstErrorField = `washer-${f}`;
      if (err) hasError = true;
    });

    if (hasError) {
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const existingWasher = editingWasherId
      ? data.washers.find((x) => x.id === editingWasherId)
      : undefined;
    const assignedBay = existingWasher?.assignedBay ?? 1;
    const cleanPhone = washerDraft.phone.replace(/\D/g, '');
    const washerDuplicate = findDuplicateStaffIdentity(
      'washer',
      { email: washerDraft.email, phone: cleanPhone ? `+61${cleanPhone}` : '', loginId: washerDraft.loginId },
      editingWasherId
    );
    if (washerDuplicate) {
      setWasherErrors(prev => ({ ...prev, [washerDuplicate.field]: washerDuplicate.message }));
      return;
    }
    try {
      setIsSavingWasher(true);
      await saveWasherToApi(branchId, {
        id: editingWasherId,
        name: washerDraft.name.trim(),
        address: washerDraft.address.trim(),
        zipCode: washerDraft.zipCode.trim(),
        email: washerDraft.email.trim(),
        phone: cleanPhone ? `+61${cleanPhone}` : '',
        doj: washerDraft.doj,
        loginId: washerDraft.loginId.trim(),
        password: washerDraft.password,
        assignedBay,
        active: washerDraft.active,
      });
      updateBranchData(branchId, (d) => d);
      setWasherDraft({
        name: '',
        address: '',
        zipCode: '',
        email: '',
        phone: '',
        doj: '',
        loginId: '',
        password: '',
        confirmPassword: '',
        active: true,
      });
      setEditingWasherId(null);
      setWasherErrors({});
    } catch (error) {
      const conflict = mapIdentityConflictError(error);
      if (conflict) {
        setWasherErrors(prev => ({ ...prev, [conflict.field]: conflict.message }));
        return;
      }
      setWasherErrors(prev => ({ ...prev, loginId: 'Unable to save washer. Please try again.' }));
    } finally {
      setIsSavingWasher(false);
    }
  };

  const editWasher = (w: Washer) => {
    setEditingWasherId(w.id);
    setShowWasherPw(false);
    setWasherDraft({
      name: w.name,
      address: w.address,
      zipCode: w.zipCode,
      email: w.email,
      phone: w.phone.startsWith('+61') ? w.phone.slice(3) : w.phone,
      doj: w.doj,
      loginId: w.loginId,
      password: '',
      confirmPassword: '',
      active: w.active,
    });
    setWasherErrors({});
  };

  const toggleWasherActive = (id: string, active: boolean) => {
    updateBranchData(branchId, (d) => ({
      ...d,
      washers: d.washers.map((w) => (w.id === id ? { ...w, active } : w)),
    }));
  };

  const removeWasher = async (id: string) => {
    const w = data.washers.find((x) => x.id === id);
    const ok = await confirm({
      title: 'Delete washer?',
      description: `Remove washer "${w?.name ?? id}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await deleteBranchWasher(branchId, id).catch(() => {});
    if (editingWasherId === id) {
      setEditingWasherId(null);
      setWasherDraft({
        name: '',
        address: '',
        zipCode: '',
        email: '',
        phone: '',
        doj: '',
        loginId: '',
        password: '',
        confirmPassword: '',
        active: true,
      });
    }
  };

  const credentialInputClass =
    'border-blue-200/80 bg-blue-50/70 shadow-inner shadow-blue-950/[0.03] focus-visible:border-primary';

  const addrPreview = (s: string, max = 48) => {
    const one = s.replace(/\s+/g, ' ').trim();
    return one.length <= max ? one : `${one.slice(0, max)}…`;
  };

  const managerColumns = [
    { key: 'name', header: 'Name', headerClassName: 'min-w-[160px]' },
    { key: 'login', header: 'Login', headerClassName: 'min-w-[170px]' },
    { key: 'email', header: 'Email', headerClassName: 'min-w-[220px]' },
    { key: 'phone', header: 'Phone', headerClassName: 'hidden lg:table-cell min-w-[130px]' },
    { key: 'address', header: 'Address', headerClassName: 'hidden xl:table-cell min-w-[260px]' },
    { key: 'zip', header: 'Zip', headerClassName: 'hidden md:table-cell min-w-[110px]' },
    { key: 'active', header: 'Active', headerClassName: 'text-center' },
    { key: 'actions', header: 'Actions', headerClassName: 'w-[124px] text-right' },
  ];

  const washerColumns = [
    { key: 'name', header: 'Name', headerClassName: 'min-w-[8rem]' },
    { key: 'email', header: 'Email', headerClassName: 'min-w-0 w-[22%]' },
    { key: 'address', header: 'Address', headerClassName: 'min-w-0' },
    { key: 'zip', header: 'Zip', headerClassName: 'w-[5rem]' },
    { key: 'active', header: 'Active', headerClassName: 'w-[4.25rem] text-center' },
    { key: 'actions', header: 'Actions', headerClassName: 'w-[168px] text-right' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-2">
      {dialog}


      <Card className="overflow-hidden border-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <CardHeader className="border-b border-slate-100 px-6 py-5 md:px-8">
          <div className="flex flex-col gap-5">
            <SegmentedPillTabs
              value={staffSegment}
              onValueChange={(v) => setStaffSegment(v as 'manager' | 'washer')}
              aria-label="Branch manager or washers"
              options={[
                { value: 'manager', label: 'Branch manager' },
                { value: 'washer', label: 'Washers' },
              ]}
            />
          </div>
        </CardHeader>

        {staffSegment === 'manager' ? (
          <>
            <CardContent className="space-y-6 px-6 py-6 md:px-8">
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg">
                    {editingManagerId ? 'Edit branch manager' : 'Add branch manager'}
                  </CardTitle>
                  {editingManagerId ? (
                    <CardDescription>Update this branch manager&apos;s details and credentials.</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bm-name">Name</Label>
                      <Input
                        id="bm-name"
                        value={mgrDraft.name}
                        onChange={(e) => {
                          setMgrDraft((m) => ({ ...m, name: e.target.value }));
                          if (mgrErrors.name) validateMgrField('name', e.target.value);
                        }}
                        onBlur={handleMgrBlur}
                        className={mgrErrors.name ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      />
                      {mgrErrors.name && <p className="text-xs font-medium text-destructive">{mgrErrors.name}</p>}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bm-address">Address</Label>
                      <Textarea
                        id="bm-address"
                        rows={3}
                        value={mgrDraft.address}
                        onChange={(e) => {
                          setMgrDraft((m) => ({ ...m, address: e.target.value }));
                          if (mgrErrors.address) validateMgrField('address', e.target.value);
                        }}
                        onBlur={handleMgrBlur}
                        placeholder="Street, building, area…"
                        className={`min-h-[92px] ${mgrErrors.address ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      {mgrErrors.address && <p className="text-xs font-medium text-destructive">{mgrErrors.address}</p>}
                    </div>
                    <div className="space-y-2 sm:max-w-xs">
                      <Label htmlFor="bm-zip">Zip / postal code</Label>
                      <Input
                        id="bm-zip"
                        value={mgrDraft.zipCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setMgrDraft((m) => ({ ...m, zipCode: val }));
                          validateMgrField('zipCode', val);
                        }}
                        onBlur={handleMgrBlur}
                        maxLength={6}
                        className={mgrErrors.zipCode ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      />
                      {mgrErrors.zipCode && <p className="text-xs font-medium text-destructive">{mgrErrors.zipCode}</p>}
                    </div>
                    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="bm-email">Email</Label>
                        <Input
                          id="bm-email"
                          type="email"
                          value={mgrDraft.email}
                          onChange={(e) => {
                            setMgrDraft((m) => ({ ...m, email: e.target.value }));
                            if (mgrErrors.email) validateMgrField('email', e.target.value);
                          }}
                          onBlur={handleMgrBlur}
                          className={mgrErrors.email ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                        />
                        {mgrErrors.email && <p className="text-xs font-medium text-destructive">{mgrErrors.email}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bm-phone">Phone</Label>
                        <div className="flex flex-col">
                          <div className="flex">
                            <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-500 font-mono">
                              +61
                            </span>
                            <Input
                              id="bm-phone"
                              value={mgrDraft.phone}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                                setMgrDraft((m) => ({ ...m, phone: val }));
                                validateMgrField('phone', val);
                              }}
                              onBlur={handleMgrBlur}
                              className={`rounded-l-none font-mono ${mgrErrors.phone ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                              placeholder="4XXXXXXXX"
                            />
                          </div>
                          {mgrErrors.phone && <p className="mt-1 text-xs font-medium text-destructive">{mgrErrors.phone}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 sm:max-w-xs">
                      <Label htmlFor="bm-doj">Date of joining</Label>
                      <Input
                        id="bm-doj"
                        type="date"
                        value={mgrDraft.doj}
                        onChange={(e) => {
                          setMgrDraft((m) => ({ ...m, doj: e.target.value }));
                          validateMgrField('doj', e.target.value);
                        }}
                        onBlur={handleMgrBlur}
                        className={mgrErrors.doj ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      />
                      {mgrErrors.doj && <p className="text-xs font-medium text-destructive">{mgrErrors.doj}</p>}
                    </div>
                    <Separator className="bg-blue-100/80 sm:col-span-2" />
                    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="bm-login">Login ID</Label>
                        <Input
                          id="bm-login"
                          value={mgrDraft.loginId}
                          onChange={(e) => {
                            setMgrDraft((m) => ({ ...m, loginId: e.target.value }));
                            if (mgrErrors.loginId) validateMgrField('loginId', e.target.value);
                          }}
                          onBlur={handleMgrBlur}
                          className={`${credentialInputClass} ${mgrErrors.loginId ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        {mgrErrors.loginId && <p className="text-xs font-medium text-destructive">{mgrErrors.loginId}</p>}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="bm-password">
                            {editingManagerId ? 'New password' : 'Password'}
                          </Label>
                          {editingManagerId && (
                            <span className="text-xs text-muted-foreground">Leave blank to keep current password</span>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            id="bm-password"
                            type={showMgrPw ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={mgrDraft.password}
                            onChange={(e) => {
                              setMgrDraft((m) => ({ ...m, password: e.target.value }));
                              validateMgrField('password', e.target.value);
                              if (mgrDraft.confirmPassword) validateMgrField('confirmPassword', mgrDraft.confirmPassword);
                            }}
                            onBlur={handleMgrBlur}
                            className={`pr-10 ${credentialInputClass} ${mgrErrors.password ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowMgrPw((p) => !p)}
                            className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                          >
                            {showMgrPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        {mgrErrors.password && <p className="text-xs font-medium text-destructive">{mgrErrors.password}</p>}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="bm-confirmPassword">
                          {editingManagerId ? 'Confirm new password' : 'Confirm password'}
                        </Label>
                        <Input
                          id="bm-confirmPassword"
                          type={showMgrPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={mgrDraft.confirmPassword}
                          onChange={(e) => {
                            setMgrDraft((m) => ({ ...m, confirmPassword: e.target.value }));
                            validateMgrField('confirmPassword', e.target.value);
                          }}
                          onBlur={(e) => validateMgrField('confirmPassword', e.target.value)}
                          className={`${credentialInputClass} ${mgrErrors.confirmPassword ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                          disabled={!mgrDraft.password}
                        />
                        {mgrErrors.confirmPassword && <p className="text-xs font-medium text-destructive">{mgrErrors.confirmPassword}</p>}
                      </div>
                    </div>
                    <div className="mb-3 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-4 sm:col-span-2 sm:max-w-md">
                      <div>
                        <p className="text-sm font-medium text-foreground">Active</p>
                      </div>
                      <Switch
                        checked={mgrDraft.active}
                        onCheckedChange={(c) => setMgrDraft((m) => ({ ...m, active: c === true }))}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <Button
                    type="button"
                    onClick={saveBranchManager}
                    disabled={isSavingManager || Object.values(mgrErrors).some(x => !!x)}
                  >
                    {isSavingManager ? 'Saving...' : editingManagerId ? 'Save changes' : 'Add manager'}
                  </Button>
                  {editingManagerId ? (
                    <Button type="button" variant="outline" onClick={resetManagerForm}>
                      Cancel
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  All branch managers
                </h3>
                {data.branchManagers.length === 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
                    <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                      No managers yet. Add one using the form above.
                    </p>
                  </div>
                ) : (
                  <PersonnelDataTable columns={managerColumns}>
                    {data.branchManagers.map((m) => (
                      <PersonnelTableRow key={m.id}>
                        <TableCell className="min-w-0 max-w-[11rem] font-medium break-words text-foreground">
                          {m.name || '—'}
                        </TableCell>
                        <TableCell className="min-w-0 max-w-[11rem] break-words text-muted-foreground">{m.loginId}</TableCell>
                        <TableCell className="min-w-0 max-w-[14rem] break-all text-muted-foreground">{m.email}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{m.phone}</TableCell>
                        <TableCell
                          className="hidden xl:table-cell max-w-[260px] whitespace-normal break-words text-muted-foreground"
                          title={m.address}
                        >
                          {addrPreview(m.address)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{m.zipCode || '—'}</TableCell>
                        <TableCell className="py-4 text-center align-middle">
                          <div className="flex min-h-8 items-center justify-center py-1">
                            <Switch
                              checked={m.active}
                              onCheckedChange={(c) => toggleBranchManagerActive(m.id, c === true)}
                              aria-label={`Active ${m.name}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="px-2 text-blue-700 hover:bg-blue-100/80"
                              onClick={() => editBranchManager(m)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="px-2 text-destructive hover:bg-destructive/10"
                              disabled={deletePendingByKey[`branch-manager:${branchId}:${m.id}`]}
                              onClick={() => handleDeleteBranchManager(m.id)}
                            >
                              {deletePendingByKey[`branch-manager:${branchId}:${m.id}`] ? 'Deleting...' : <Trash2 className="size-4" />}
                            </Button>
                            {deleteErrorByKey[`branch-manager:${branchId}:${m.id}`] ? (
                              <span className="text-xs text-destructive">{deleteErrorByKey[`branch-manager:${branchId}:${m.id}`]}</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </PersonnelTableRow>
                    ))}
                  </PersonnelDataTable>
                )}
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="space-y-6 px-6 py-6 md:px-8">
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg">{editingWasherId ? 'Edit washer' : 'Add washer'}</CardTitle>
                {editingWasherId ? (
                  <CardDescription>Update this washer&apos;s profile and login.</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="washer-name">Name</Label>
                      <Input
                        id="washer-name"
                        value={washerDraft.name}
                        onChange={(e) => {
                          setWasherDraft((w) => ({ ...w, name: e.target.value }));
                          if (washerErrors.name) validateWasherField('name', e.target.value);
                        }}
                        onBlur={handleWasherBlur}
                        className={washerErrors.name ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      />
                      {washerErrors.name && <p className="text-xs font-medium text-destructive">{washerErrors.name}</p>}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="washer-address">Address</Label>
                      <Textarea
                        id="washer-address"
                        rows={3}
                        value={washerDraft.address}
                        onChange={(e) => {
                          setWasherDraft((w) => ({ ...w, address: e.target.value }));
                          if (washerErrors.address) validateWasherField('address', e.target.value);
                        }}
                        onBlur={handleWasherBlur}
                        placeholder="Street, building, area…"
                        className={`min-h-[92px] ${washerErrors.address ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      {washerErrors.address && <p className="text-xs font-medium text-destructive">{washerErrors.address}</p>}
                    </div>
                    <div className="space-y-2 sm:max-w-xs">
                      <Label htmlFor="washer-zip">Zip / postal code</Label>
                      <Input
                        id="washer-zip"
                        value={washerDraft.zipCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setWasherDraft((w) => ({ ...w, zipCode: val }));
                          validateWasherField('zipCode', val);
                        }}
                        onBlur={handleWasherBlur}
                        maxLength={6}
                        className={washerErrors.zipCode ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      />
                      {washerErrors.zipCode && <p className="text-xs font-medium text-destructive">{washerErrors.zipCode}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="washer-email">Email</Label>
                      <Input
                        id="washer-email"
                        type="email"
                        value={washerDraft.email}
                        onChange={(e) => {
                          setWasherDraft((w) => ({ ...w, email: e.target.value }));
                          if (washerErrors.email) validateWasherField('email', e.target.value);
                        }}
                        onBlur={handleWasherBlur}
                        className={washerErrors.email ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      />
                      {washerErrors.email && <p className="text-xs font-medium text-destructive">{washerErrors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="washer-phone">Phone</Label>
                      <div className="flex flex-col">
                        <div className="flex">
                          <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-500 font-mono">
                            +61
                          </span>
                          <Input
                            id="washer-phone"
                            value={washerDraft.phone}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                              setWasherDraft((w) => ({ ...w, phone: val }));
                              validateWasherField('phone', val);
                            }}
                            onBlur={handleWasherBlur}
                            className={`rounded-l-none font-mono ${washerErrors.phone ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                            placeholder="4XXXXXXXX"
                          />
                        </div>
                        {washerErrors.phone && <p className="mt-1 text-xs font-medium text-destructive">{washerErrors.phone}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="washer-doj">Date of joining</Label>
                      <Input
                        id="washer-doj"
                        type="date"
                        value={washerDraft.doj}
                        onChange={(e) => {
                          setWasherDraft((w) => ({ ...w, doj: e.target.value }));
                          validateWasherField('doj', e.target.value);
                        }}
                        onBlur={handleWasherBlur}
                        className={washerErrors.doj ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                      />
                      {washerErrors.doj && <p className="text-xs font-medium text-destructive">{washerErrors.doj}</p>}
                    </div>
                  </div>
                  <Separator className="bg-blue-200/60" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="washer-login">Login ID</Label>
                      <Input
                        id="washer-login"
                        value={washerDraft.loginId}
                        onChange={(e) => {
                          setWasherDraft((w) => ({ ...w, loginId: e.target.value }));
                          if (washerErrors.loginId) validateWasherField('loginId', e.target.value);
                        }}
                        onBlur={handleWasherBlur}
                        className={`${credentialInputClass} ${washerErrors.loginId ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      {washerErrors.loginId && <p className="text-xs font-medium text-destructive">{washerErrors.loginId}</p>}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="washer-password">
                          {editingWasherId ? 'New password' : 'Password'}
                        </Label>
                        {editingWasherId && (
                          <span className="text-xs text-muted-foreground">Leave blank to keep current password</span>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="washer-password"
                          type={showWasherPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={washerDraft.password}
                          onChange={(e) => {
                            setWasherDraft((w) => ({ ...w, password: e.target.value }));
                            validateWasherField('password', e.target.value);
                            if (washerDraft.confirmPassword) validateWasherField('confirmPassword', washerDraft.confirmPassword);
                          }}
                          onBlur={handleWasherBlur}
                          className={`pr-10 ${credentialInputClass} ${washerErrors.password ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowWasherPw((p) => !p)}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                        >
                          {showWasherPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {washerErrors.password && <p className="text-xs font-medium text-destructive">{washerErrors.password}</p>}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="washer-confirmPassword">
                        {editingWasherId ? 'Confirm new password' : 'Confirm password'}
                      </Label>
                      <Input
                        id="washer-confirmPassword"
                        type={showWasherPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={washerDraft.confirmPassword}
                        onChange={(e) => {
                          setWasherDraft((w) => ({ ...w, confirmPassword: e.target.value }));
                          validateWasherField('confirmPassword', e.target.value);
                        }}
                        onBlur={(e) => validateWasherField('confirmPassword', e.target.value)}
                        className={`${credentialInputClass} ${washerErrors.confirmPassword ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}`}
                        disabled={!washerDraft.password}
                      />
                      {washerErrors.confirmPassword && <p className="text-xs font-medium text-destructive">{washerErrors.confirmPassword}</p>}
                    </div>
                  </div>
                  <div className="mb-3 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-4 sm:max-w-md">
                    <div>
                      <p className="text-sm font-medium text-foreground">Active</p>
                    </div>
                    <Switch
                      checked={washerDraft.active}
                      onCheckedChange={(c) => setWasherDraft((w) => ({ ...w, active: c === true }))}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button
                  type="button"
                  onClick={saveWasher}
                  className="gap-1.5"
                  disabled={isSavingWasher || Object.values(washerErrors).some(x => !!x)}
                >
                  <Plus className="size-4" />
                  {isSavingWasher ? 'Saving...' : editingWasherId ? 'Update washer' : 'Add washer'}
                </Button>
                {editingWasherId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingWasherId(null);
                      setWasherDraft({
                        name: '',
                        address: '',
                        zipCode: '',
                        email: '',
                        phone: '',
                        doj: '',
                        loginId: '',
                        password: '',
                        active: true,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </CardFooter>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">
                All washers
              </h3>
              {data.washers.length === 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
                  <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No washers yet. Add one using the form above.
                  </p>
                </div>
              ) : (
                <PersonnelDataTable columns={washerColumns}>
                  {data.washers.map((w) => (
                    <PersonnelTableRow key={w.id}>
                      <TableCell className="min-w-0 font-medium break-words text-foreground">{w.name || w.loginId}</TableCell>
                      <TableCell className="min-w-0 break-all text-muted-foreground">{w.email}</TableCell>
                      <TableCell className="min-w-0 text-muted-foreground" title={w.address}>
                        {addrPreview(w.address)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{w.zipCode || '—'}</TableCell>
                      <TableCell className="py-4 text-center align-middle">
                        <div className="flex min-h-8 items-center justify-center py-1">
                          <Switch
                            checked={w.active}
                            onCheckedChange={(c) => toggleWasherActive(w.id, c === true)}
                            aria-label={`Active ${w.name}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-blue-700 hover:bg-blue-100/80"
                            onClick={() => editWasher(w)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={deletePendingByKey[`branch-washer:${branchId}:${w.id}`]}
                            onClick={() => removeWasher(w.id)}
                          >
                            <Trash2 className="size-4" />
                            {deletePendingByKey[`branch-washer:${branchId}:${w.id}`] ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                        {deleteErrorByKey[`branch-washer:${branchId}:${w.id}`] ? (
                          <p className="text-xs text-destructive">{deleteErrorByKey[`branch-washer:${branchId}:${w.id}`]}</p>
                        ) : null}
                      </TableCell>
                    </PersonnelTableRow>
                  ))}
                </PersonnelDataTable>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
