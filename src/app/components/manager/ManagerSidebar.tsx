import { Building2, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, ListOrdered, UserPlus, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { BRAND_NAME, PORTAL_LABELS } from '../../lib/branding';
import { AppLogo } from '../AppLogo';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

const items = [
  { to: '/manager/view-bookings', label: 'View bookings', icon: ListOrdered },
  { to: '/manager/create-booking', label: 'Create booking', icon: UserPlus },
  { to: '/manager/configure-bay', label: 'Configure bay', icon: CalendarClock },
  { to: '/manager/washers', label: 'Washer detail', icon: Users },
  { to: '/manager/leave-requests', label: 'Washer leave requests', icon: ClipboardList },
] as const;

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

function navClass(active: boolean, collapsed: boolean) {
  return cn(
    'group flex items-center rounded-lg py-2.5 text-[13px] font-medium transition-all duration-150',
    collapsed ? 'justify-center px-0' : 'gap-2.5 pl-3 pr-3',
    active
      ? 'bg-indigo-50 font-semibold text-indigo-700 shadow-[inset_3px_0_0_0_#4f46e5]'
      : 'text-slate-900 hover:bg-slate-50 hover:text-black',
  );
}

function iconClass(active: boolean) {
  return cn(
    'size-[18px] shrink-0 transition-colors',
    active ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900',
  );
}

export function ManagerSidebar({ collapsed, onToggleCollapsed }: Props) {
  const { pathname } = useLocation();

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 shrink-0 flex-col border-r border-slate-100 bg-white shadow-[4px_0_32px_-16px_rgba(15,23,42,0.06)] transition-[width] duration-200 ease-out',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      {/* Brand */}
      <div className={cn('border-b border-slate-200/80 px-4 py-4', collapsed && 'px-2')}>
        <div className={cn(collapsed ? 'flex justify-center' : 'flex flex-col gap-2')}>
          <AppLogo variant={collapsed ? 'rail' : 'sidebar'} />
          {!collapsed ? (
            <>
              <span className="sr-only">{BRAND_NAME}</span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">
                {PORTAL_LABELS.branch}
              </p>
            </>
          ) : (
            <span className="sr-only">{BRAND_NAME}</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Menu
          </p>
        )}
        <ul className="space-y-0.5">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <li key={to}>
                <Link to={to} className={navClass(active, collapsed)} title={collapsed ? label : undefined}>
                  <Icon className={iconClass(active)} strokeWidth={active ? 2.1 : 1.75} />
                  {!collapsed ? <span className="truncate">{label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-200/80 p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-full rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}
