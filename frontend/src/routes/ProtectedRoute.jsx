import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Shown briefly while we try to resume a session from the refresh cookie. */
function FullScreenSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
