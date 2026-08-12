import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Check, X, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { profileSchema } from '../utils/validationSchemas';
import { useAuth } from '../hooks/useAuth';
import userService from '../services/userService';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName || '', avatar: user?.avatar || '' },
  });

  const startEditing = () => {
    reset({ fullName: user?.fullName || '', avatar: user?.avatar || '' });
    setServerError(null);
    setIsEditing(true);
  };

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const updated = await userService.updateProfile(values);
      setUser(updated);
      setIsEditing(false);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Could not update profile. Please try again.');
    }
  };

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="container max-w-2xl py-12">
      <div className="mb-6">
        <span className="exhibit-tag">Case File · Profile</span>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>Account details and preferences.</CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar} alt={user.fullName} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display text-xl font-semibold">{user.fullName}</p>
              <Badge className="mt-1">{user.role}</Badge>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" {...register('fullName')} />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input id="avatar" placeholder="https://…" {...register('avatar')} />
                {errors.avatar && <p className="text-xs text-destructive">{errors.avatar.message}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  <Check className="mr-2 h-3.5 w-3.5" />
                  {isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
                <dd className="mt-1 text-sm">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</dt>
                <dd className="mt-1 text-sm capitalize">{user.role}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Member since</dt>
                <dd className="mt-1 font-mono text-sm">{formatDate(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last login</dt>
                <dd className="mt-1 font-mono text-sm">{formatDate(user.lastLogin)}</dd>
              </div>
            </dl>
          )}
        </CardContent>

        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Case management, document uploads, and analysis tools unlock as later modules land.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
