import { Navigate } from 'react-router';
import { useManagerSession } from '../../hooks/useManagerSession';
import { useMobileManagerSession } from '../../hooks/useMobileManagerSession';

export default function ManagerIndexRedirect() {
  const { session: branch } = useManagerSession();
  const { session: mobile } = useMobileManagerSession();
  if (mobile) return <Navigate to="/manager/mobile/view-bookings" replace />;
  if (branch) return <Navigate to="/manager/view-bookings" replace />;
  return <Navigate to="/manager/login" replace />;
}
