import { Link, useNavigate } from 'react-router';
import { LoginCard } from '../components/LoginCard';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import { useAdminSession } from '../hooks/useAdminSession';
import { CheckCircle } from 'lucide-react';
import { BRAND_NAME, PORTAL_LABELS } from '../lib/branding';
import { AppLogo } from '../components/AppLogo';

const features = [
  'Multi-branch management from one console',
  'Staff, services & add-ons per branch',
  'Day / time-based dynamic pricing',
  'Loyalty programs & promotions',
  'Mobile service team coordination',
  'Branch & mobile manager portals from one admin',
];

export default function LoginPage() {
  const { session } = useAdminSession();
  const navigate = useNavigate();

  const cardShell =
    'rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <section className={cn(cardShell, 'p-6 sm:p-8 md:p-10')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <AppLogo variant="sidebar" className="max-w-[min(100%,320px)] shrink-0 sm:max-w-[360px]" />
            <div className="shrink-0">
              <span className="sr-only">{BRAND_NAME}</span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">{PORTAL_LABELS.admin}</p>
            </div>
          </div>

          <div className="mt-8 md:mt-10">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl md:text-[2.05rem]">
              Run your car wash operations from one place
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Manage branches, staff, pricing, promotions, and mobile services with a clean admin workflow.
            </p>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                <CheckCircle className="mt-0.5 size-4 shrink-0 text-indigo-600" strokeWidth={2} />
                <span className="text-sm leading-snug text-slate-700">{f}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex w-full min-w-0 flex-col">
          <div className={cn(cardShell, 'flex w-full flex-col p-6 sm:p-8')}>
            {session ? (
              <div className="flex flex-1 flex-col text-center">
                <p className="text-sm text-slate-500">Already signed in as</p>
                <p className="mt-1 font-semibold text-slate-800">{session.loginId}</p>
                <Button
                  type="button"
                  className="mt-6 h-11 w-full font-semibold sm:max-w-xs sm:self-center"
                  onClick={() => navigate('/create-branch', { replace: true })}
                >
                  Go to Admin Console
                </Button>
              </div>
            ) : (
              <LoginCard />
            )}

            <div className="mt-6 border-t border-slate-100 pt-5 text-center sm:mt-8 sm:pt-6">
              <Link
                to="/manager/login"
                className="text-sm font-semibold text-indigo-600 underline-offset-4 hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2"
              >
                Manager sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
