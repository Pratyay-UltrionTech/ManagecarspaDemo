import {
  Building2,
  Users,
  Wrench,
  Package,
  Tag,
  Clock,
  Truck,
  History,
  Settings,
  Gift,
  UserSearch,
  BarChart2,
  DollarSign,
  CalendarDays,
  UserCheck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { PORTAL_LABELS } from '../lib/branding';

function branchSectionItemActive(pathname: string, href: string): boolean {
  if (href === '/create-branch') return pathname === '/create-branch';
  if (href === '/staff') return pathname === '/staff' || pathname.startsWith('/staff/');
  if (href === '/services') return pathname === '/services' || pathname.startsWith('/services/');
  if (href === '/service-addons')
    return pathname === '/service-addons' || pathname.startsWith('/service-addons/');
  if (href === '/promotions') return pathname === '/promotions' || pathname.startsWith('/promotions/');
  if (href === '/day-time-pricing')
    return pathname === '/day-time-pricing' || pathname.startsWith('/day-time-pricing/');
  if (href === '/loyalty') return pathname === '/loyalty' || pathname.startsWith('/loyalty/');
  return false;
}

function organizeBranchSectionActive(pathname: string): boolean {
  return (
    pathname === '/create-branch' ||
    pathname === '/staff' ||
    pathname.startsWith('/staff/') ||
    pathname === '/services' ||
    pathname.startsWith('/services/') ||
    pathname === '/service-addons' ||
    pathname.startsWith('/service-addons/') ||
    pathname === '/promotions' ||
    pathname.startsWith('/promotions/') ||
    pathname === '/day-time-pricing' ||
    pathname.startsWith('/day-time-pricing/') ||
    pathname === '/loyalty' ||
    pathname.startsWith('/loyalty/')
  );
}

function mobileSubActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const organizeBranchChildren: { label: string; to: string; icon: typeof Users }[] = [
  { label: 'Branches', to: '/create-branch', icon: Building2 },
  { label: 'Staff', to: '/staff', icon: Users },
  { label: 'Services', to: '/services', icon: Wrench },
  { label: 'Add-ons', to: '/service-addons', icon: Package },
  { label: 'Promotions', to: '/promotions', icon: Tag },
  { label: 'Day / time pricing', to: '/day-time-pricing', icon: Clock },
  { label: 'Loyalty', to: '/loyalty', icon: Gift },
];

const mobileChildren: { label: string; to: string; icon: typeof Users }[] = [
  { label: 'Staff', to: '/mobile-services/team', icon: Users },
  { label: 'Services', to: '/mobile-services/services', icon: Wrench },
  { label: 'Add-ons', to: '/mobile-services/add-ons', icon: Package },
  { label: 'Promotions', to: '/mobile-services/promo-codes', icon: Tag },
  { label: 'Day / time pricing', to: '/mobile-services/day-time-pricing', icon: Clock },
  { label: 'Loyalty', to: '/mobile-services/loyalty', icon: Gift },
];

const childLinkClass = (active: boolean) =>
  `group flex items-center gap-2.5 rounded-lg py-2 pl-9 pr-3 text-[12.5px] font-medium transition-all duration-150 ${
    active
      ? 'bg-indigo-50 font-semibold text-indigo-700 shadow-[inset_3px_0_0_0_#4f46e5]'
      : 'text-slate-800 hover:bg-slate-50 hover:text-black'
  }`;

const navItemClass = (active: boolean) =>
  `group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
    active
      ? 'bg-indigo-50 font-semibold text-indigo-700 shadow-[inset_3px_0_0_0_#4f46e5]'
      : 'text-slate-900 hover:bg-slate-50 hover:text-black'
  }`;

export function Sidebar() {
  const location = useLocation();
  const { pathname } = location;

  const organizeActive = organizeBranchSectionActive(pathname);
  const mobileRootActive = pathname.startsWith('/mobile-services');

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-[4px_0_32px_-16px_rgba(15,23,42,0.06)]">

      <div className="border-b border-slate-200/80 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">
          {PORTAL_LABELS.admin}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">

        {/* Branch Operations */}
        <div>
          <div className="mb-1.5 flex items-center gap-2 px-3 py-1">
            <Building2
              className={`size-3.5 shrink-0 ${organizeActive ? 'text-indigo-500' : 'text-slate-600'}`}
              strokeWidth={2}
            />
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${organizeActive ? 'text-indigo-500' : 'text-slate-600'}`}
            >
              Branch operations
            </p>
          </div>
          <ul className="space-y-0.5">
            {organizeBranchChildren.map((item) => {
              const Icon = item.icon;
              const active = branchSectionItemActive(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link to={item.to} className={childLinkClass(active)}>
                    <Icon
                      className={`size-3.5 shrink-0 ${active ? 'text-indigo-500' : 'text-slate-600 group-hover:text-slate-800'}`}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Mobile Operations */}
        <div>
          <div className="mb-1.5 flex items-center gap-2 px-3 py-1">
            <Truck
              className={`size-3.5 shrink-0 ${mobileRootActive ? 'text-indigo-500' : 'text-slate-600'}`}
              strokeWidth={2}
            />
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${mobileRootActive ? 'text-indigo-500' : 'text-slate-600'}`}
            >
              Mobile operations
            </p>
          </div>
          <ul className="space-y-0.5">
            {mobileChildren.map((item) => {
              const Icon = item.icon;
              const active = mobileSubActive(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link to={item.to} className={childLinkClass(active)}>
                    <Icon
                      className={`size-3.5 shrink-0 ${active ? 'text-indigo-500' : 'text-slate-600 group-hover:text-slate-800'}`}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Customers */}
        <div>
          <Link
            to="/customers"
            className={navItemClass(pathname === '/customers' || pathname.startsWith('/customers/'))}
          >
            <UserSearch
              className={`size-4 shrink-0 ${
                pathname === '/customers' || pathname.startsWith('/customers/')
                  ? 'text-indigo-500'
                  : 'text-slate-600 group-hover:text-slate-800'
              }`}
              strokeWidth={pathname === '/customers' || pathname.startsWith('/customers/') ? 2.2 : 1.8}
            />
            Customers
          </Link>
        </div>

        {/* Reports */}
        <div>
          <div className="mb-1.5 flex items-center gap-2 px-3 py-1">
            <BarChart2
              className={`size-3.5 shrink-0 ${(pathname === '/revenue-report' || pathname === '/booking-report' || pathname === '/staff-job-report') ? 'text-indigo-500' : 'text-slate-600'}`}
              strokeWidth={2}
            />
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${(pathname === '/revenue-report' || pathname === '/booking-report' || pathname === '/staff-job-report') ? 'text-indigo-500' : 'text-slate-600'}`}
            >
              Reports
            </p>
          </div>
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/revenue-report"
                className={childLinkClass(pathname === '/revenue-report')}
              >
                <DollarSign
                  className={`size-3.5 shrink-0 ${pathname === '/revenue-report' ? 'text-indigo-500' : 'text-slate-600 group-hover:text-slate-800'}`}
                  strokeWidth={pathname === '/revenue-report' ? 2.2 : 1.8}
                />
                Revenue Summary
              </Link>
            </li>
            <li>
              <Link
                to="/booking-report"
                className={childLinkClass(pathname === '/booking-report')}
              >
                <CalendarDays
                  className={`size-3.5 shrink-0 ${pathname === '/booking-report' ? 'text-indigo-500' : 'text-slate-600 group-hover:text-slate-800'}`}
                  strokeWidth={pathname === '/booking-report' ? 2.2 : 1.8}
                />
                Booking Summary
              </Link>
            </li>
            <li>
              <Link
                to="/staff-job-report"
                className={childLinkClass(pathname === '/staff-job-report')}
              >
                <UserCheck
                  className={`size-3.5 shrink-0 ${pathname === '/staff-job-report' ? 'text-indigo-500' : 'text-slate-600 group-hover:text-slate-800'}`}
                  strokeWidth={pathname === '/staff-job-report' ? 2.2 : 1.8}
                />
                Washer &amp; Driver Jobs
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-auto">
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/settings"
                className={navItemClass(pathname === '/settings')}
              >
                <Settings
                  className={`size-4 shrink-0 ${pathname === '/settings' ? 'text-indigo-500' : 'text-slate-600 group-hover:text-slate-800'}`}
                  strokeWidth={pathname === '/settings' ? 2.2 : 1.8}
                />
                Settings
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </aside>
  );
}
