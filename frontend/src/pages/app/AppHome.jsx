import { Navigate } from 'react-router-dom';

export default function AppHome() {
  return <Navigate to="/app/cases/ongoing" replace />;
}
