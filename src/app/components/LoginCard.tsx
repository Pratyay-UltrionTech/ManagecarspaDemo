import { Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAdminSession } from '../hooks/useAdminSession';
import { apiAdminLogin } from '../lib/apiClient';
import { API_BASE } from '../lib/apiBase';

// ── helpers ───────────────────────────────────────────────────────────────────

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium ${ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
      {ok
        ? <CheckCircle2 className="size-4 shrink-0" />
        : <AlertCircle className="size-4 shrink-0" />}
      {msg}
    </div>
  );
}

// ── Forgot password flow ──────────────────────────────────────────────────────

function ForgotPasswordFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [done, setDone] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/forgot-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); const msg = typeof b?.detail === 'object' ? b.detail.detail : (b?.detail || 'Failed to send OTP'); throw new Error(msg); }
      setStep('reset');
      setStatus({ ok: true, msg: `If that email belongs to an admin account, an OTP has been sent.` });
    } catch (e: any) { setStatus({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword) return;
    if (newPassword.length < 8) { setStatus({ ok: false, msg: 'Password must be at least 8 characters.' }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp, new_password: newPassword }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || 'Failed to reset password'); }
      setDone(true);
      setStatus({ ok: true, msg: 'Password reset successfully! You can now sign in.' });
    } catch (e: any) { setStatus({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="w-full min-w-0">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </button>

      <div className="mb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {step === 'email'
            ? 'Enter your admin email and we\'ll send you a one-time code.'
            : 'Enter the OTP sent to your email and choose a new password.'}
        </p>
      </div>

      {/* Step 1 — email */}
      {step === 'email' && (
        <form onSubmit={requestOtp} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="fp-email" className="block text-sm font-medium text-slate-800">Email address</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                id="fp-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="admin@example.com"
                required
                disabled={loading}
              />
            </div>
          </div>
          {status && <StatusMsg ok={status.ok} msg={status.msg} />}
          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}

      {/* Step 2 — OTP + new password */}
      {step === 'reset' && !done && (
        <form onSubmit={resetPassword} className="space-y-4">
          {status && <StatusMsg ok={status.ok} msg={status.msg} />}
          <div className="space-y-2">
            <label htmlFor="fp-otp" className="block text-sm font-medium text-slate-800">One-time code (OTP)</label>
            <input
              type="text"
              id="fp-otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="block h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 tracking-widest"
              placeholder="Enter 6-digit code"
              required
              disabled={loading}
              maxLength={6}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="fp-pw" className="block text-sm font-medium text-slate-800">New password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPw ? 'text' : 'password'}
                id="fp-pw"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Min 8 characters"
                required
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('email'); setOtp(''); setNewPassword(''); setStatus(null); }}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
            disabled={loading}
          >
            Resend OTP
          </button>
        </form>
      )}

      {/* Done */}
      {done && status && (
        <div className="space-y-4">
          <StatusMsg ok={status.ok} msg={status.msg} />
          <button
            type="button"
            onClick={onBack}
            className="h-11 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            Go to Sign In
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main login card ───────────────────────────────────────────────────────────

export function LoginCard() {
  const navigate = useNavigate();
  const { login } = useAdminSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await apiAdminLogin(email.trim(), password);
      login({ loginId: email.trim(), accessToken: token.access_token });
      navigate('/create-branch', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid email or password. Please try again.';
      setError(message);
      setLoading(false);
    }
  };

  if (showForgot) {
    return <ForgotPasswordFlow onBack={() => setShowForgot(false)} />;
  }

  return (
    <div className="w-full min-w-0">
      <div className="mb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-600">Sign in to your admin account to continue.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-slate-800">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Admin login ID"
              autoComplete="username"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-800">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-[12px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
            <p className="text-[13px] text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
