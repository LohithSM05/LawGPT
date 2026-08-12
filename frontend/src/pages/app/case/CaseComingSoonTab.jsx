import { useParams } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { COMING_SOON_TABS } from './CaseDetailLayout';

export default function CaseComingSoonTab() {
  const { section } = useParams();
  const tab = COMING_SOON_TABS.find((t) => t.slug === section);
  const Icon = tab?.icon || HelpCircle;

  return (
    <div className="container flex min-h-[50vh] max-w-md flex-col items-center justify-center py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold">{tab?.label || section}</h2>
      {tab && (
        <Badge variant="accent" className="mt-3">
          Planned — Module {tab.plannedModule}
        </Badge>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        This section of the case folder will be built out once its backing data and AI pipeline exist.
      </p>
    </div>
  );
}
