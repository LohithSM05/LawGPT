import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { registerSchema, ROLES } from '../../utils/validationSchemas';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterForm() {
  const { t } = useTranslation('auth');
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '', role: 'student' },
  });

  const password = watch('password');

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await registerUser(values);
      navigate('/app', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      setServerError(message);
    }
  };

  const checks = [
    { key: 'length', test: (v) => v?.length >= 8 },
    { key: 'case', test: (v) => /[a-z]/.test(v || '') && /[A-Z]/.test(v || '') },
    { key: 'number', test: (v) => /\d/.test(v || '') },
    { key: 'special', test: (v) => /[^A-Za-z0-9]/.test(v || '') },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">{t('register.fullName')}</Label>
        <Input id="fullName" autoComplete="name" placeholder="Anita Rao" {...register('fullName')} />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('register.email')}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="you@lawfirm.com" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">{t('register.role')}</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="role">
                <SelectValue placeholder={t('register.selectRole')} />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(`register.roles.${r.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('register.password')}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <ul className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-2">
          {checks.map((c) => {
            const passed = c.test(password);
            return (
              <li key={c.key} className={`text-xs ${passed ? 'text-primary' : 'text-muted-foreground'}`}>
                {passed ? '✓' : '·'} {t(`register.passwordChecks.${c.key}`)}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('register.confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="••••••••"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('register.submitting') : t('register.submit')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('register.signIn')}
        </Link>
      </p>
    </form>
  );
}
