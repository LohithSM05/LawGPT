import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import LoginForm from '../components/auth/LoginForm';

export default function Login() {
  const { t } = useTranslation('auth');

  return (
    <div className="bg-ledger flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <span className="exhibit-tag">{t('login.eyebrow')}</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('login.title')}</CardTitle>
            <CardDescription>{t('login.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
