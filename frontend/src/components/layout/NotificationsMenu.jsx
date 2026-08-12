import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel } from '../ui/dropdown-menu';

export default function NotificationsMenu() {
  const { t } = useTranslation('nav');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('topbar.notifications')}>
          <Bell className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>{t('topbar.notifications')}</DropdownMenuLabel>
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t('topbar.noNotifications')}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
