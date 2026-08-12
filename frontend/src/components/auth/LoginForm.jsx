import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { loginSchema } from '../../utils/validationSchemas';
import { useAuth } from '../../hooks/useAuth';

export default function LoginForm() {
  const { t } = useTranslation('auth');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values);
      const redirectTo = location.state?.from?.pathname || '/app';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      setServerError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('login.email')}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="you@lawfirm.com" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('login.password')}</Label>
          <Link to="/forgot-password" className="text-xs text-primary hover:underline">
            {t('login.forgotPassword')}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => <Checkbox id="rememberMe" checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Label htmlFor="rememberMe" className="cursor-pointer text-sm font-normal">
          {t('login.rememberMe')}
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('login.submitting') : t('login.submit')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          {t('login.createOne')}
        </Link>
      </p>
    </form>
  );
}
