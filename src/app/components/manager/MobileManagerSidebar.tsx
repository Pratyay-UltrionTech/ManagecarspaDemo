import { CalendarDays, CalendarPlus, ClipboardList, SlidersHorizontal, Truck } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { PORTAL_LABELS } from '../../lib/branding';

const items = [
  { to: '/manager/mobile/view-bookings', label: 'View bookings', icon: CalendarDays },
  { to: '/manager/mobile/create-booking', label: 'Create booking', icon: CalendarPlus },
  { to: '/manager/mobile/configure-slots', label: 'Configure slot', icon: SlidersHorizontal },
  { to: '/manager/mobile/drivers', label: 'Drivers', icon: Truck },
  { to: '/manager/mobile/leave-requests', label: 'Driver Leave Requests', icon: ClipboardList },
] as const;

function navClass(active: boolean) {
  return `group flex items-center gap-2.5 rounded-lg py-2.5 pl-3 pr-3 text-[13px] font-medium transition-all duration-150 ${
    active
      ? 'bg-indigo-50 font-semibold text-indigo-700 shadow-[inset_3px_0_0_0_#4f46e5]'
      : 'text-slate-900 hover:bg-slate-50 hover:text-black'
  }`;
}

function iconClass(active: boolean) {
  return `size-[18px] shrink-0 transition-colors ${active ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`;
}

export function MobileManagerSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-[4px_0_32px_-16px_rgba(15,23,42,0.06)]">

      <div className="border-b border-slate-200/80 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">
          {PORTAL_LABELS.mobile}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Menu
        </p>
        <ul className="space-y-0.5">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <li key={to}>
                <Link to={to} className={navClass(active)}>
                  <Icon className={iconClass(active)} strokeWidth={active ? 2.1 : 1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
