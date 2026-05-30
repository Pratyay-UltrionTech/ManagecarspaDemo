import { Navigate } from 'react-router';

/** Legacy URL — slot configuration moved to Configure slot. */
export default function MobileCreateSlotsPage() {
  return <Navigate to="/manager/mobile/configure-slots" replace />;
}
