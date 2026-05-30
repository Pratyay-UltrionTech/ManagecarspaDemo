import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { useManagerSession } from '../../hooks/useManagerSession';
import { setMobileManagerSession } from '../../hooks/useMobileManagerSession';

type Props = {
  branchName: string;
};

export function ManagerHeader({ branchName }: Props) {
  const navigate = useNavigate();
  const { logout } = useManagerSession();

  const onLogout = () => {
    setMobileManagerSession(null);
    logout();
    navigate('/manager/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-6 py-3 md:px-8">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h1 className="truncate text-lg font-bold tracking-tight text-foreground md:text-xl">{branchName}</h1>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 md:text-xs">
            Branch manager portal
          </p>
        </div>
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
    </header>
  );
}
