import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function SearchResults() {
  const [params] = useSearchParams();
  const query = params.get('q') || '';

  return (
    <div className="container flex min-h-[60vh] max-w-xl flex-col items-center justify-center py-12 text-center">
      <Search className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        Search isn&apos;t wired to live case/document/judgment indexes yet — that arrives with later modules.
      </p>
      {query && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Query received: <span className="text-foreground">{query}</span>
        </p>
      )}
    </div>
  );
}
