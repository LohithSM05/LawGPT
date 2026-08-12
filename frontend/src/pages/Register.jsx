import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import RegisterForm from '../components/auth/RegisterForm';

export default function Register() {
  const { t } = useTranslation('auth');

  return (
    <div className="bg-ledger flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <span className="exhibit-tag">{t('register.eyebrow')}</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('register.title')}</CardTitle>
            <CardDescription>{t('register.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
