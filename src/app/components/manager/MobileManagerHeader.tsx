import { LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { useMobileManagerSession } from '../../hooks/useMobileManagerSession';

function titleForMobilePath(pathname: string): string {
  if (pathname.includes('/mobile/view-bookings')) return 'View bookings';
  if (pathname.includes('/mobile/create-booking')) return 'Create booking';
  if (pathname.includes('/mobile/configure-slots')) return 'Configure slot';
  if (pathname.includes('/mobile/create-slots')) return 'Configure slot';
  if (pathname.includes('/mobile/drivers')) return 'Drivers';
  if (pathname.includes('/mobile/tasks')) return 'View bookings';
  return 'Dashboard';
}

export function MobileManagerHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useMobileManagerSession();
  const pageTitle = titleForMobilePath(pathname);

  const onLogout = () => {
    logout();
    navigate('/manager/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-6 py-3 md:px-8">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h1 className="truncate text-lg font-bold tracking-tight text-foreground md:text-xl">Mobile manager portal</h1>
          <p className="truncate text-[11px] text-slate-500 md:text-xs">{pageTitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 rounded-lg border-slate-200 px-3 text-xs font-medium shadow-sm"
            onClick={onLogout}
          >
            <LogOut className="size-3.5" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
