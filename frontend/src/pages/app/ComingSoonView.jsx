import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

/**
 * Renders one page for any entry in researchTools / practiceTools
 * (frontend/src/config/toolsRegistry.js). Pass the matching registry array
 * as a prop from the route config — see AppRoutes.jsx.
 */
export default function ComingSoonView({ registry }) {
  const { slug } = useParams();
  const { t } = useTranslation('nav');
  const tool = registry.find((r) => r.slug === slug);

  const Icon = tool?.icon || HelpCircle;
  const label = tool ? t(tool.labelKey) : slug;

  return (
    <div className="container flex min-h-[70vh] max-w-xl flex-col items-center justify-center py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold">{label}</h1>
      {tool && (
        <Badge variant="accent" className="mt-3">
          {t('comingSoon.badge', { module: tool.plannedModule })}
        </Badge>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        {tool?.note ||
          'This tool is part of the planned Legal Research / Practice Management suite and will be built out once its backing data and AI pipeline exist.'}
      </p>
      <Button variant="outline" size="sm" className="mt-6" asChild>
        <Link to="/app/cases/ongoing">
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          {t('comingSoon.backToWorkspace')}
        </Link>
      </Button>
    </div>
  );
}
