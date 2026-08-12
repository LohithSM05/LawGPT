import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { useAuth } from '../../hooks/useAuth';

export default function Navbar() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const initials = (user?.fullName || '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Scale className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">{t('brand')}</span>
        </Link>

        <nav className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              <Button size="sm" asChild>
                <Link to="/app">{t('actions.openWorkspace')}</Link>
              </Button>
              <Link to="/app/profile" className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} alt={user?.fullName} />
                  <AvatarFallback>{initials || 'U'}</AvatarFallback>
                </Avatar>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                {t('actions.logout')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">{t('actions.signIn')}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">{t('actions.getStarted')}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
