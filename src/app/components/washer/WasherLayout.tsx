import { Navigate, Outlet } from 'react-router';
import { WasherHeader } from './WasherHeader';
import { useWasherSession } from '../../hooks/useWasherSession';

export default function WasherLayout() {
  const { session } = useWasherSession();
  if (!session) return <Navigate to="/washer/login" replace />;
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/80">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/40">
        <WasherHeader branchName={session.branchName} washerName={session.washerName} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto grid min-h-full w-full min-w-0 max-w-[1320px] grid-cols-12 gap-6 px-6 py-8 md:gap-8 md:px-8 md:py-10">
            <div className="col-span-12 min-w-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

