import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { BRAND_NAME, PORTAL_LABELS } from '../../lib/branding';
import { AppLogo } from '../../components/AppLogo';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';
import { useWasherSession } from '../../hooks/useWasherSession';
import { apiListBranches, apiWasherLogin, apiForgotPassword, apiVerifyOtp, apiResetPassword } from '../../lib/apiClient';

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
      await apiForgotPassword('washer', identifier.trim());
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
      await apiVerifyOtp('washer', identifier.trim(), otp.trim());
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
      await apiResetPassword('washer', identifier.trim(), newPassword);
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
        <AppLogo variant="auth" className="mx-auto drop-shadow-sm" />
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
                placeholder="e.g. washer@example.com"
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

export default function WasherLoginPage() {
  const { session, login } = useWasherSession();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (session) {
    navigate('/washer/jobs', { replace: true });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const lid = loginId.trim();
    const pw = password;
    try {
      const branches = await apiListBranches();
      const matches: Array<{ branchId: string; branchName: string; token: string }> = [];
      for (const b of branches) {
        try {
          const t = await apiWasherLogin(b.id, lid, pw);
          matches.push({ branchId: b.id, branchName: b.name, token: t.access_token });
        } catch {
          // try next branch
        }
      }
      if (matches.length === 1) {
        const found = matches[0]!;
        login({
          branchId: found.branchId,
          branchName: found.branchName,
          washerId: lid,
          washerName: lid,
          loginId: lid,
          accessToken: found.token,
        });
        navigate('/washer/jobs', { replace: true });
        return;
      }
      if (matches.length > 1) {
        setError(
          'That washer login ID is valid for more than one branch. Ask admin to make washer login IDs unique.'
        );
        setLoading(false);
        return;
      }
      setError('No active washer matches those credentials.');
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setError(msg);
      setLoading(false);
    }
  };

  const brandPanel = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <section className={cn(brandPanel, 'p-6 sm:p-8 md:p-10')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <AppLogo variant="sidebar" className="max-w-[min(100%,320px)] shrink-0 sm:max-w-[360px]" />
            <div className="shrink-0">
              <span className="sr-only">{BRAND_NAME}</span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">{PORTAL_LABELS.washer}</p>
            </div>
          </div>
          <div className="mt-8 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to view your jobs</h1>
            <p className="text-sm text-slate-600">
              Use the washer login ID and password created by your admin.
            </p>
          </div>
        </section>

        <section className="flex w-full min-w-0 flex-col">
          {showForgotPassword ? (
            <ForgotPasswordFlow onClose={() => setShowForgotPassword(false)} />
          ) : (
            <Card className="w-full rounded-2xl border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04]">
              <CardHeader className="space-y-2 pb-2 text-center sm:px-8">
                <AppLogo variant="auth" className="mx-auto drop-shadow-sm" />
                <CardTitle className="text-2xl font-bold tracking-tight">Washer sign in</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ws-login">Login ID</Label>
                    <Input
                      id="ws-login"
                      autoComplete="username"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="h-11 border-slate-200 bg-white shadow-sm focus-visible:ring-indigo-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-pw">Password</Label>
                    <Input
                      id="ws-pw"
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
                  <Button type="submit" className="h-11 w-full font-semibold shadow-sm" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
                <div className="mt-6 border-t border-slate-100 pt-5 text-center sm:mt-8 sm:pt-6">
                  <Link
                    to="/manager/login"
                    className="text-sm font-semibold text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2"
                  >
                    Manager sign in
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
