import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function ForgotPassword() {
  return (
    <div className="bg-ledger flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <CardTitle className="pt-3">Password reset isn&apos;t wired up yet</CardTitle>
          <CardDescription>
            Email-based password reset needs a transactional email service, which isn&apos;t part of the
            authentication module yet. It&apos;s tracked as a follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
