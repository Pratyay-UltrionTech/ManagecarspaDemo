import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useManagerSession } from '../../hooks/useManagerSession';
import { useMobileManagerSession } from '../../hooks/useMobileManagerSession';
import { ManagerSidebar } from './ManagerSidebar';
import { ManagerHeader } from './ManagerHeader';
import { MobileManagerSidebar } from './MobileManagerSidebar';
import { MobileManagerHeader } from './MobileManagerHeader';
import { BRAND_NAME, PORTAL_LABELS } from '../../lib/branding';

export default function ManagerLayout() {
  const { pathname } = useLocation();
  const { session: branch } = useManagerSession();
  const { session: mobile } = useMobileManagerSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const label = mobile ? PORTAL_LABELS.mobile : PORTAL_LABELS.branch;
    document.title = `${label} · ${BRAND_NAME}`;
  }, [mobile]);

  if (!branch && !mobile) {
    return <Navigate to="/manager/login" replace />;
  }

  if (mobile) {
    if (!pathname.startsWith('/manager/mobile')) {
      return <Navigate to="/manager/mobile/view-bookings" replace />;
    }
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <MobileManagerSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-slate-100 bg-white/50">
          <MobileManagerHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto grid w-full min-w-0 max-w-[1320px] grid-cols-12 gap-6 px-6 py-8 md:gap-8 md:px-8 md:py-10">
              <div className="col-span-12 min-w-0">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (pathname.startsWith('/manager/mobile')) {
    return <Navigate to="/manager/configure-bay" replace />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/80">
      <ManagerSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-slate-200/60 bg-slate-50/40">
        <ManagerHeader branchName={branch!.branchName} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto grid w-full min-w-0 max-w-[1320px] grid-cols-12 gap-6 px-6 py-8 md:gap-8 md:px-8 md:py-10">
            <div className="col-span-12 min-w-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
