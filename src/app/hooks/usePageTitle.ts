import { useLocation } from 'react-router';

function titleForPath(pathname: string): string {
  if (pathname.startsWith('/login')) return 'Sign in';
  if (pathname.startsWith('/manager/login')) return 'Manager sign in';
  if (pathname.startsWith('/manager/mobile/view-bookings')) return 'Mobile manager — View bookings';
  if (pathname.startsWith('/manager/mobile/create-booking')) return 'Mobile manager — Create booking';
  if (pathname.startsWith('/manager/mobile/configure-slots')) return 'Mobile manager — Configure slot';
  if (pathname.startsWith('/manager/mobile/create-slots')) return 'Mobile manager — Configure slot';
  if (pathname.startsWith('/manager/mobile/drivers')) return 'Mobile manager — Drivers';
  if (pathname.startsWith('/manager/mobile/tasks')) return 'Mobile manager — View bookings';
  if (pathname.startsWith('/manager/configure-bay')) return 'Manager — Configure bay';
  if (pathname.startsWith('/manager/configure-slots')) return 'Manager — Configure bay';
  if (pathname.startsWith('/manager/assign-jobs')) return 'Manager — Create booking';
  if (pathname.startsWith('/manager/create-booking')) return 'Manager — Create booking';
  if (pathname.startsWith('/manager/view-bookings')) return 'Manager — View bookings';
  if (pathname.startsWith('/manager')) return 'Manager portal';
  if (pathname.startsWith('/create-branch')) return 'Organize branch — Create branch';
  if (pathname.startsWith('/staff/')) return 'Branch Staff';
  if (pathname === '/staff') return 'Branch Staff';
  if (pathname.startsWith('/services/')) return 'Branch services';
  if (pathname === '/services') return 'Branch services';
  if (pathname === '/service-addons') return 'Create add-ons';
  if (pathname.startsWith('/service-addons/')) return 'Create add-ons';
  if (pathname.startsWith('/promotions/')) return 'Promotions';
  if (pathname === '/promotions') return 'Promotions';
  if (pathname.startsWith('/day-time-pricing/')) return 'Day / time based pricing';
  if (pathname === '/day-time-pricing') return 'Day / time based pricing';
  if (pathname.startsWith('/free-coffee/')) return 'Free coffee rules';
  if (pathname === '/free-coffee') return 'Free coffee rules';
  if (pathname.startsWith('/loyalty/')) return 'Configure loyalty';
  if (pathname === '/loyalty') return 'Configure loyalty';
  if (pathname.startsWith('/mobile-services/services')) return 'Mobile services — Services';
  if (pathname.startsWith('/mobile-services/add-ons')) return 'Mobile services — Add-ons';
  if (pathname.startsWith('/mobile-services/promo-codes')) return 'Mobile services — Promo codes';
  if (pathname.startsWith('/mobile-services/day-time-pricing')) return 'Mobile services — Day / time pricing';
  if (pathname.startsWith('/mobile-services/team')) return 'Mobile services — Staff';
  if (pathname.startsWith('/mobile-services/loyalty')) return 'Mobile services — Configure loyalty';
  if (pathname === '/mobile-services') return 'Mobile services';
  return 'Admin';
}

export function usePageTitle() {
  const location = useLocation();
  return titleForPath(location.pathname);
}
