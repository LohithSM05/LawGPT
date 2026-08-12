import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Keeps a logged-in user off the login/register pages. */
export default function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/app" replace />;

  return <Outlet />;
}
