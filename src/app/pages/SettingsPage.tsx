import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Mail,
  Lock,
  UserPlus,
  Building2,
  Truck,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Tag,
  Clock,
  Gift,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { API_BASE } from '../lib/apiBase';
import { useAdminSession } from '../hooks/useAdminSession';
import { cn } from '../components/ui/utils';

// ── types ────────────────────────────────────────────────────────────────────

interface MeResponse {
  is_env_admin: boolean;
  email: string | null;
  id: string | null;
}

interface AdminListItem {
  id: string;
  email: string;
}

interface ServiceInfo {
  name: string;
  category: string | null;
}

interface VehicleBlock {
  vehicle_type: string;
  services: ServiceInfo[];
}

interface PromoCode {
  id: string;
  code: string;
  type: string;
  value: number;
}

interface BranchOverview {
  id: string;
  name: string;
  location: string;
  managers: { id: string; name: string; login_id: string }[];
  staff: { id: string; name: string }[];
  vehicles: VehicleBlock[];
  promo_codes: PromoCode[];
  day_time_rules_count: number;
  addons: string[];
  loyalty_configured: boolean;
  loyalty_qualifying_count: number | null;
}

interface MobileOpsOverview {
  managers: { id: string; name: string; login_id: string }[];
  staff: { id: string; name: string; login_id: string }[];
  vehicles: VehicleBlock[];
  promo_codes: PromoCode[];
  day_time_rules_count: number;
  addons: string[];
  loyalty_configured: boolean;
  loyalty_qualifying_count: number | null;
}

interface OverviewData {
  branches: BranchOverview[];
  mobile_ops: MobileOpsOverview;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</Label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
      {ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
      {msg}
    </div>
  );
}

// ── Account & Admins tab ──────────────────────────────────────────────────────

type AccountAction =
  | { type: 'none' }
  | { type: 'edit_self_email' }
  | { type: 'edit_self_password' }
  | { type: 'add_admin' };

function AccountTab({ token, me }: { token: string; me: MeResponse | null }) {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [action, setAction] = useState<AccountAction>({ type: 'none' });
  const [refresh, setRefresh] = useState(0);

  const reload = () => setRefresh((n) => n + 1);

  useEffect(() => {
    fetch(`${API_BASE}/admin/settings/admins`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setAdmins(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [token, refresh]);

  const deleteAdmin = async (id: string, email: string) => {
    if (!window.confirm(`Delete admin "${email}"? They will no longer be able to log in.`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/settings/admins/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); alert(b?.detail || 'Failed to delete admin.'); return; }
      reload();
    } catch { alert('Failed to delete admin.'); }
  };

  return (
    <div className="space-y-6">
      {/* Env admin notice */}
      {me?.is_env_admin && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Shield className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.8} />
          <div>
            <p className="text-sm font-semibold text-amber-800">Environment Admin</p>
            <p className="mt-0.5 text-xs text-amber-700">
              You are logged in as the environment (super) admin. Email and password are managed
              through server environment variables and cannot be changed here. You can still add
              or remove DB admin accounts below.
            </p>
          </div>
        </div>
      )}

      {/* ── Admins table ── */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-800">Admin Accounts</CardTitle>
          <CardDescription className="text-xs">All active DB admin accounts. Env admin is separate and always active.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {admins.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No DB admin accounts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="pl-5 pr-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0">
                    <td className="pl-5 pr-3 py-3 font-medium text-slate-800">{a.email}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => deleteAdmin(a.id, a.email)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.8} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-3">
        {!me?.is_env_admin && (
          <>
            <Button
              variant={action.type === 'edit_self_email' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setAction(action.type === 'edit_self_email' ? { type: 'none' } : { type: 'edit_self_email' })}
            >
              <Mail className="size-3.5" /> Change My Email
            </Button>
            <Button
              variant={action.type === 'edit_self_password' ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setAction(action.type === 'edit_self_password' ? { type: 'none' } : { type: 'edit_self_password' })}
            >
              <Lock className="size-3.5" /> Change My Password
            </Button>
          </>
        )}
        <Button
          variant={action.type === 'add_admin' ? 'default' : 'outline'}
          className="gap-2"
          onClick={() => setAction(action.type === 'add_admin' ? { type: 'none' } : { type: 'add_admin' })}
        >
          <UserPlus className="size-3.5" /> Add New Admin
        </Button>
      </div>

      {/* ── Forms ── */}
      {action.type === 'edit_self_email' && (
        <SelfChangeEmailForm token={token} onDone={() => setAction({ type: 'none' })} />
      )}
      {action.type === 'edit_self_password' && (
        <SelfChangePasswordForm token={token} onDone={() => setAction({ type: 'none' })} />
      )}
      {action.type === 'add_admin' && (
        <AddAdminForm token={token} onDone={() => { setAction({ type: 'none' }); reload(); }} onCancel={() => setAction({ type: 'none' })} />
      )}
    </div>
  );
}

// ── Self: change email (OTP) ──────────────────────────────────────────────────

function SelfChangeEmailForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'idle' | 'otp'>('idle');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const requestOtp = async () => {
    if (!newEmail) { setStatus({ ok: false, msg: 'Please enter the new email.' }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/change-email/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_email: newEmail }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || 'Failed to send OTP'); }
      setStep('otp');
      setStatus({ ok: true, msg: `OTP sent to ${newEmail}. Check your inbox.` });
    } catch (e: any) { setStatus({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!otp) { setStatus({ ok: false, msg: 'Please enter the OTP.' }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/change-email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_email: newEmail, otp }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || 'Verification failed'); }
      setStatus({ ok: true, msg: 'Email updated successfully! Please log in again with your new email.' });
      setTimeout(onDone, 1500);
    } catch (e: any) { setStatus({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <Card className="border-slate-200/60 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50">
            <Mail className="size-4 text-indigo-600" strokeWidth={1.8} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800">Change My Email</CardTitle>
            <CardDescription className="text-xs">An OTP will be sent to the new address to verify ownership.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <InputField label="New Email Address" type="email" value={newEmail} onChange={setNewEmail} placeholder="new@example.com" disabled={step === 'otp' || loading} />
        {step === 'idle' && (
          <div className="flex gap-3">
            <Button onClick={requestOtp} disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-3.5 animate-spin" />} Send OTP
            </Button>
            <Button variant="outline" onClick={onDone} disabled={loading}>Cancel</Button>
          </div>
        )}
        {step === 'otp' && (
          <>
            <InputField label="Enter OTP" value={otp} onChange={setOtp} placeholder="6-digit code" disabled={loading} />
            <div className="flex gap-3">
              <Button onClick={verifyOtp} disabled={loading} className="gap-2">
                {loading && <Loader2 className="size-3.5 animate-spin" />} Verify & Update
              </Button>
              <Button variant="outline" onClick={() => { setStep('idle'); setOtp(''); setStatus(null); }} disabled={loading}>Back</Button>
            </div>
          </>
        )}
        {status && <StatusMsg ok={status.ok} msg={status.msg} />}
      </CardContent>
    </Card>
  );
}

// ── Self: change password ─────────────────────────────────────────────────────

function SelfChangePasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async () => {
    if (!current || !next) { setStatus({ ok: false, msg: 'Please fill in both fields.' }); return; }
    if (next.length < 8) { setStatus({ ok: false, msg: 'New password must be at least 8 characters.' }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || 'Failed to change password'); }
      setStatus({ ok: true, msg: 'Password changed successfully!' });
      setTimeout(onDone, 1500);
    } catch (e: any) { setStatus({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <Card className="border-slate-200/60 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50">
            <Lock className="size-4 text-amber-600" strokeWidth={1.8} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800">Change My Password</CardTitle>
            <CardDescription className="text-xs">Enter your current password to set a new one.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <InputField label="Current Password" type="password" value={current} onChange={setCurrent} placeholder="" disabled={loading} />
        <InputField label="New Password" type="password" value={next} onChange={setNext} placeholder="Min 8 characters" disabled={loading} />
        <div className="flex gap-3">
          <Button onClick={submit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-3.5 animate-spin" />} Update Password
          </Button>
          <Button variant="outline" onClick={onDone} disabled={loading}>Cancel</Button>
        </div>
        {status && <StatusMsg ok={status.ok} msg={status.msg} />}
      </CardContent>
    </Card>
  );
}

// ── Add new admin ─────────────────────────────────────────────────────────────

function AddAdminForm({ token, onDone, onCancel }: { token: string; onDone: () => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'idle' | 'otp'>('idle');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const requestOtp = async () => {
    if (!email || !password) { setStatus({ ok: false, msg: 'Please fill in email and password.' }); return; }
    if (password.length < 8) { setStatus({ ok: false, msg: 'Password must be at least 8 characters.' }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/add-admin/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || 'Failed to send OTP'); }
      setStep('otp');
      setStatus({ ok: true, msg: `OTP sent to ${email}. Ask the new admin to check their inbox.` });
    } catch (e: any) { setStatus({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  };

  const confirm = async () => {
    if (!otp) { setStatus({ ok: false, msg: 'Please enter the OTP.' }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/add-admin/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || 'Failed to add admin'); }
      setStatus({ ok: true, msg: `Admin ${email} added successfully!` });
      setTimeout(onDone, 1000);
    } catch (e: any) { setStatus({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <Card className="border-emerald-200 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50">
            <UserPlus className="size-4 text-emerald-600" strokeWidth={1.8} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800">Add New Admin</CardTitle>
            <CardDescription className="text-xs">New admins have full access. Email is verified with an OTP before the account is created.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="admin@example.com" disabled={step === 'otp' || loading} />
        <InputField label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 characters" disabled={step === 'otp' || loading} />
        {step === 'idle' && (
          <div className="flex gap-3">
            <Button onClick={requestOtp} disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-3.5 animate-spin" />} Send Verification OTP
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          </div>
        )}
        {step === 'otp' && (
          <>
            <InputField label="OTP (sent to new admin's email)" value={otp} onChange={setOtp} placeholder="6-digit code" disabled={loading} />
            <div className="flex gap-3">
              <Button onClick={confirm} disabled={loading} className="gap-2">
                {loading && <Loader2 className="size-3.5 animate-spin" />} Confirm & Add Admin
              </Button>
              <Button variant="outline" onClick={() => { setStep('idle'); setOtp(''); setStatus(null); }} disabled={loading}>Back</Button>
            </div>
          </>
        )}
        {status && <StatusMsg ok={status.ok} msg={status.msg} />}
      </CardContent>
    </Card>
  );
}

// ── section: Overview ─────────────────────────────────────────────────────────

function LoyaltyCard({
  configured,
  qualifyingCount,
  editTo,
}: {
  configured: boolean;
  qualifyingCount: number | null;
  editTo: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gift className="size-3.5 text-slate-500" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold text-slate-600">Loyalty</span>
        </div>
        <Link to={editTo} className="flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:underline">
          Edit <ChevronRight className="size-3" />
        </Link>
      </div>
      {configured ? (
        <p className="text-[11px] text-slate-700">
          Configured · <span className="font-semibold">{qualifyingCount}</span> services to qualify
        </p>
      ) : (
        <p className="text-[11px] text-slate-400">Not configured yet.</p>
      )}
    </div>
  );
}

function OverviewSection({ token }: { token: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/admin/settings/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Branches */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="size-4 text-indigo-500" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-slate-800">Branch Operations</h2>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
            {data.branches.length} branch{data.branches.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <div className="space-y-4">
          {data.branches.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              No branches yet.{' '}
              <Link to="/create-branch" className="font-medium text-indigo-600 hover:underline">
                Create one
              </Link>
            </p>
          )}
          {data.branches.map((b) => (
            <Card key={b.id} className="border-slate-200/60 shadow-sm">
              <CardContent className="p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{b.name}</p>
                    <p className="text-xs text-slate-500">{b.location}</p>
                  </div>
                  <Link to="/create-branch">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      Edit Branch <ChevronRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Managers */}
                  <OverviewCard
                    title="Managers"
                    icon={Users}
                    count={b.managers.length}
                    editTo={`/staff/${b.id}`}
                    items={b.managers.map((m) => m.name || m.login_id)}
                  />

                  {/* Staff */}
                  <OverviewCard
                    title="Staff (Washers)"
                    icon={Users}
                    count={b.staff.length}
                    editTo={`/staff/${b.id}`}
                    items={b.staff.map((s) => s.name)}
                  />

                  {/* Promo Codes */}
                  <OverviewCard
                    title="Promo Codes"
                    icon={Tag}
                    count={b.promo_codes.length}
                    editTo={`/promotions/${b.id}`}
                    items={b.promo_codes.map((p) => `${p.code} (${p.type === 'percent' ? `${p.value}%` : `$${p.value}`} off)`)}
                  />

                  {/* Day-time pricing */}
                  <OverviewCard
                    title="Day / Time Pricing"
                    icon={Clock}
                    count={b.day_time_rules_count}
                    editTo={`/day-time-pricing/${b.id}`}
                    items={[]}
                    showCount
                  />

                  {/* Add-ons */}
                  <OverviewCard
                    title="Add-ons"
                    icon={Tag}
                    count={b.addons.length}
                    editTo={`/service-addons/${b.id}`}
                    items={b.addons}
                  />

                  {/* Loyalty */}
                  <LoyaltyCard
                    configured={b.loyalty_configured}
                    qualifyingCount={b.loyalty_qualifying_count}
                    editTo={`/loyalty/${b.id}`}
                  />
                </div>

                {/* Services by vehicle type */}
                {b.vehicles.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Services by Vehicle Type</p>
                      <Link to={`/services/${b.id}`} className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline">
                        Edit Services <ChevronRight className="size-3" />
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {b.vehicles.map((vb) => (
                        <div key={vb.vehicle_type} className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold text-slate-700">{vb.vehicle_type}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {vb.services.map((s) => (
                              <span
                                key={s.name}
                                className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
                              >
                                {s.name}
                                {s.category && (
                                  <span className="ml-1 text-slate-400">· {s.category}</span>
                                )}
                              </span>
                            ))}
                            {vb.services.length === 0 && (
                              <span className="text-[10px] text-slate-400">No services</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Mobile Operations */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Truck className="size-4 text-emerald-500" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-slate-800">Mobile Operations</h2>
        </div>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <OverviewCard
                title="Managers"
                icon={Users}
                count={data.mobile_ops.managers.length}
                editTo="/mobile-services/team"
                items={data.mobile_ops.managers.map((m) => m.name || m.login_id)}
              />
              <OverviewCard
                title="Drivers"
                icon={Users}
                count={data.mobile_ops.staff.length}
                editTo="/mobile-services/team"
                items={data.mobile_ops.staff.map((d) => d.name || d.login_id)}
              />
              <OverviewCard
                title="Promo Codes"
                icon={Tag}
                count={data.mobile_ops.promo_codes.length}
                editTo="/mobile-services/promo-codes"
                items={data.mobile_ops.promo_codes.map((p) => `${p.code} (${p.type === 'percent' ? `${p.value}%` : `$${p.value}`} off)`)}
              />
              <OverviewCard
                title="Day / Time Pricing"
                icon={Clock}
                count={data.mobile_ops.day_time_rules_count}
                editTo="/mobile-services/day-time-pricing"
                items={[]}
                showCount
              />

              {/* Add-ons */}
              <OverviewCard
                title="Add-ons"
                icon={Tag}
                count={data.mobile_ops.addons.length}
                editTo="/mobile-services/add-ons"
                items={data.mobile_ops.addons}
              />

              {/* Loyalty */}
              <LoyaltyCard
                configured={data.mobile_ops.loyalty_configured}
                qualifyingCount={data.mobile_ops.loyalty_qualifying_count}
                editTo="/mobile-services/loyalty"
              />
            </div>

            {/* Mobile services by vehicle */}
            {data.mobile_ops.vehicles.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Services by Vehicle Type</p>
                  <Link to="/mobile-services/services" className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline">
                    Edit Services <ChevronRight className="size-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.mobile_ops.vehicles.map((vb) => (
                    <div key={vb.vehicle_type} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-700">{vb.vehicle_type}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {vb.services.map((s) => (
                          <span
                            key={s.name}
                            className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
                          >
                            {s.name}
                            {s.category && <span className="ml-1 text-slate-400">· {s.category}</span>}
                          </span>
                        ))}
                        {vb.services.length === 0 && <span className="text-[10px] text-slate-400">No services</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OverviewCard({
  title,
  icon: Icon,
  count,
  editTo,
  items,
  showCount = false,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  editTo: string;
  items: string[];
  showCount?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-slate-500" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold text-slate-600">{title}</span>
        </div>
        <Link to={editTo} className="flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:underline">
          Edit <ChevronRight className="size-3" />
        </Link>
      </div>
      {showCount ? (
        <p className="text-lg font-semibold text-slate-900">{count} rule{count !== 1 ? 's' : ''}</p>
      ) : items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.slice(0, 4).map((item, i) => (
            <li key={i} className="truncate text-[11px] text-slate-700">{item}</li>
          ))}
          {items.length > 4 && (
            <li className="text-[10px] text-slate-400">+{items.length - 4} more</li>
          )}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-400">None added yet.</p>
      )}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'account';

export default function SettingsPage() {
  const { session } = useAdminSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const token = session?.accessToken ?? '';

  const loadMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/settings/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMe(await res.json());
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { void loadMe(); }, [loadMe]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'account', label: 'Account & Admins' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your admin account and get a quick overview of all branches and mobile operations.
        </p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && token && <OverviewSection token={token} />}

      {/* Account tab */}
      {tab === 'account' && <AccountTab token={token} me={me} />}
    </div>
  );
}
