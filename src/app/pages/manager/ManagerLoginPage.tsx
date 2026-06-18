import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';
import { PORTAL_LABELS } from '../../lib/branding';
import { useManagerSession } from '../../hooks/useManagerSession';
import { setMobileManagerSession, useMobileManagerSession } from '../../hooks/useMobileManagerSession';
import { apiListBranches, apiManagerLogin, apiMobileManagerLogin, apiForgotPassword, apiVerifyOtp, apiResetPassword } from '../../lib/apiClient';
import { isValidPinCode } from '../../lib/mobileServicesStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { cn } from '../../components/ui/utils';

const highlights = [
  'Single login for branch and mobile managers',
  'Role is auto-detected from credentials',
  'Quick access to bookings, slots, and staffing',
];

type FpStep = 'input' | 'otp' | 'reset' | 'done';

function ForgotPasswordFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<FpStep>('input');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setError('');
    setLoading(true);
    try {
      await apiForgotPassword('manager', identifier.trim());
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiVerifyOtp('manager', identifier.trim(), otp.trim());
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiResetPassword('manager', identifier.trim(), newPassword);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full rounded-2xl border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04]">
      <CardHeader className="space-y-1 pb-2 text-center sm:px-8">
        <CardTitle className="text-xl font-bold tracking-tight">Reset Password</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8 space-y-4">
        {step === 'input' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <p className="text-sm text-slate-500">Enter your Login ID or email and we'll send you a 6-digit code.</p>
            <div className="space-y-2">
              <Label>Login ID or email</Label>
              <Input
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. manager@example.com"
                className="h-11 border-slate-200 bg-white shadow-sm focus-visible:ring-indigo-100"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="h-11 w-full font-semibold shadow-sm">
              {loading ? 'Sending…' : 'Send Code'}
            </Button>
            <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 hover:text-indigo-600 py-1 transition-colors">
              Back to sign in
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-slate-500">
              Enter the 6-digit code sent to the email address on file for <strong>{identifier}</strong>.
            </p>
            <div className="space-y-2">
              <Label>6-digit code</Label>
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="h-14 border-slate-200 bg-white shadow-sm text-center text-2xl font-mono tracking-widest focus-visible:ring-indigo-100"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || otp.length !== 6} className="h-11 w-full font-semibold shadow-sm">
              {loading ? 'Verifying…' : 'Verify Code'}
            </Button>
            <button
              type="button"
              onClick={() => { setStep('input'); setOtp(''); setError(''); }}
              className="w-full text-sm text-slate-500 hover:text-indigo-600 py-1 transition-colors"
            >
              Resend code
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-slate-500">Create a new password for your account.</p>
            <div className="space-y-2">
              <Label>New password</Label>
              <div className="relative">
                <Input
                  autoFocus
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 pr-10 border-slate-200 bg-white shadow-sm focus-visible:ring-indigo-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-indigo-600"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 border-slate-200 bg-white shadow-sm focus-visible:ring-indigo-100"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="h-11 w-full font-semibold shadow-sm">
              {loading ? 'Saving…' : 'Save New Password'}
            </Button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              Password updated successfully! Sign in with your new password.
            </div>
            <Button onClick={onClose} className="h-11 w-full font-semibold shadow-sm">
              Back to Sign In
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ManagerLoginPage() {
  const { session: branchSession, login: branchLogin } = useManagerSession();
  const { session: mobileSession, login: mobileLogin } = useMobileManagerSession();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (branchSession) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">You are signed in as {branchSession.managerName}.</p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => navigate('/manager/view-bookings', { replace: true })}
        >
          Go to portal
        </Button>
      </div>
    );
  }

  if (mobileSession) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">You are signed in as {mobileSession.managerName}.</p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => navigate('/manager/mobile/view-bookings', { replace: true })}
        >
          Go to mobile portal
        </Button>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const lid = loginId.trim();
    const pw = password;
    if (!lid || !pw) {
      setError('Enter your login ID and password.');
      setLoading(false);
      return;
    }

    try {
      const branches = await apiListBranches();
      const matches: Array<{ branchId: string; branchName: string; token: string }> = [];
      for (const branch of branches) {
        try {
          const t = await apiManagerLogin(branch.id, lid, pw);
          matches.push({ branchId: branch.id, branchName: branch.name, token: t.access_token });
        } catch {
          // ignore per-branch failures
        }
      }
      if (matches.length === 1) {
        const found = matches[0]!;
        setMobileManagerSession(null);
        branchLogin({
          branchId: found.branchId,
          branchName: found.branchName,
          managerId: lid,
          managerName: lid,
          loginId: lid,
          accessToken: found.token,
        });
        navigate('/manager/view-bookings', { replace: true });
        return;
      }
      if (matches.length > 1) {
        setError(
          'That login ID is valid for more than one branch. Ask admin to make manager login IDs unique.'
        );
        setLoading(false);
        return;
      }
    } catch {
      // Fall through to mobile manager auth below.
    }

    try {
      const t = await apiMobileManagerLogin(lid, pw);
      const pinNorm = String(t.city_pin_code ?? '')
        .replace(/\D/g, '')
        .slice(0, 6);
      if (!isValidPinCode(pinNorm)) {
        setError('No active branch or mobile manager matches those credentials.');
        setLoading(false);
        return;
      }
      const displayZip = String(t.zip_code ?? '').trim() || pinNorm;
      const managerName = String(t.emp_name ?? '').trim() || lid;
      mobileLogin({
        cityPinCode: pinNorm,
        displayZip,
        managerName,
        loginId: lid,
        accessToken: t.access_token,
      });
      navigate('/manager/mobile/view-bookings', { replace: true });
      return;
    } catch {
      setError('No active branch or mobile manager matches those credentials.');
      setLoading(false);
    }
  };

  const brandPanel = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <section className={cn(brandPanel, 'p-6 sm:p-8 md:p-10')}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">{PORTAL_LABELS.manager}</p>

          <div className="mt-8 md:mt-10">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl md:text-[2.05rem]">
              Keep bookings and slots on track
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Sign in with manager credentials and continue managing branch or mobile operations.
            </p>
          </div>

          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                <CheckCircle className="mt-0.5 size-4 shrink-0 text-indigo-600" strokeWidth={2} />
                <span className="text-sm leading-snug text-slate-700">{h}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex w-full min-w-0 flex-col">
          {showForgotPassword ? (
            <ForgotPasswordFlow onClose={() => setShowForgotPassword(false)} />
          ) : (
            <Card className="w-full rounded-2xl border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04]">
              <CardHeader className="pb-2 text-center sm:px-8">
                <CardTitle className="text-2xl font-bold tracking-tight">Manager sign in</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mgr-login">Login ID</Label>
                    <Input
                      id="mgr-login"
                      autoComplete="username"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="h-11 border-slate-200 bg-white shadow-sm focus-visible:ring-indigo-100"
                      placeholder="e.g. manager@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mgr-pw">Password</Label>
                    <Input
                      id="mgr-pw"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 border-slate-200 bg-white shadow-sm focus-visible:ring-indigo-100"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-[12px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" disabled={loading} className="h-11 w-full font-semibold shadow-sm">
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
                <div className="mt-6 border-t border-slate-100 pt-5 text-center sm:mt-8 sm:pt-6">
                  <Link
                    to="/login"
                    className="text-sm font-semibold text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2"
                  >
                    Admin sign in
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
