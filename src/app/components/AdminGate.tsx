import { Navigate } from 'react-router';
import { useAdminSession } from '../hooks/useAdminSession';
import Layout from './Layout';

/** Wraps the admin shell; requires a successful `/login` session. */
export default function AdminGate() {
  const { session } = useAdminSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}
