import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '../ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '../../i18n/config';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation('nav');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('topbar.language')}>
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{t('topbar.language')}</DropdownMenuLabel>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onSelect={() => i18n.changeLanguage(lang.code)}>
            <span className="flex-1">{lang.label}</span>
            {i18n.language === lang.code && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
