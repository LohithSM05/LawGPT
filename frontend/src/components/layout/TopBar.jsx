import { Menu } from 'lucide-react';
import { useSidebar } from '../../hooks/useSidebar';
import { Button } from '../ui/button';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationsMenu from './NotificationsMenu';
import ProfileMenu from './ProfileMenu';
import GlobalSearchInput from './GlobalSearchInput';

export default function TopBar() {
  const { openMobile } = useSidebar();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={openMobile} aria-label="Open menu">
        <Menu className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <GlobalSearchInput />
      </div>

      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}
