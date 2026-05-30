import { Search, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAdminSession } from '../hooks/useAdminSession';
import { Button } from './ui/button';

function adminInitials(loginId: string): string {
  const local = loginId.split('@')[0] ?? loginId;
  const letters = local.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  return local.slice(0, 2).toUpperCase() || 'AD';
}

export function Header() {
  const pageTitle = usePageTitle();
  const navigate = useNavigate();
  const { session, logout } = useAdminSession();
  const displayName = session?.loginId ?? 'Administrator';
  const initials = useMemo(() => (session ? adminInitials(session.loginId) : 'AD'), [session]);

  return (
    <header className="sticky top-0 z-10 flex h-[60px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {/* Left: Page title */}
      <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-800">
        {pageTitle}
      </h2>

      {/* Right: actions */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search…"
            className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 lg:w-64"
          />
        </div>

        {/* Notification bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
        >
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500 ring-1 ring-white" />
        </button>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-slate-200" />

        {/* User info + logout */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="hidden max-w-[160px] text-left sm:block">
            <p className="truncate text-[13px] font-semibold text-slate-800 leading-tight">{displayName}</p>
            <p className="text-[11px] text-slate-400 leading-tight">Administrator</p>
          </div>
          <ChevronDown className="hidden sm:block size-3.5 text-slate-400" />
        </div>

        {/* Logout */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-slate-200 bg-white px-3 text-[12.5px] text-slate-600 shadow-none hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
