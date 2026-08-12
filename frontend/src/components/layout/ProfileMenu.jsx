import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileMenu() {
  const { t } = useTranslation('nav');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 rounded-full" aria-label={t('topbar.profile')}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar} alt={user.fullName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/profile">
            <UserIcon className="mr-2 h-4 w-4" />
            {t('topbar.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t('topbar.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
