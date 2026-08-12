import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4 text-center">
      <Compass className="h-10 w-10 text-muted-foreground" />
      <h1 className="font-display text-3xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Button asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
