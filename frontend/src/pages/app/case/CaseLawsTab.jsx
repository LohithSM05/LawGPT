import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ScrollText, Loader2, Sparkles } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import analysisService from '../../../services/analysisService';

function docNames(analysis) {
  const map = {};
  (analysis?.documents || []).forEach((d) => {
    map[d.documentId] = d.documentName || 'Document';
  });
  return map;
}

export default function CaseLawsTab() {
  const { caseId } = useOutletContext();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analysisService
      .getAnalysis(caseId)
      .then((existing) => setAnalysis(existing))
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="container max-w-3xl py-6">
        <p className="py-8 text-center text-sm text-muted-foreground">Loading applicable laws…</p>
      </div>
    );
  }

  const laws = analysis?.laws || [];
  const names = analysis ? docNames(analysis) : {};

  return (
    <div className="container max-w-3xl py-6">
      <h2 className="font-display text-lg font-semibold">Applicable Laws</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        IPC / BNS / BNSS / BSA references identified in this case&apos;s documents by the AI analysis.
      </p>

      {!analysis || analysis.status === 'failed' ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <ScrollText className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {analysis?.status === 'failed'
              ? 'The analysis failed — retry it from the AI Analysis tab.'
              : 'No analysis yet — generate one to see applicable laws.'}
          </p>
          <Button size="sm" variant="outline" className="mt-4" asChild>
            <Link to={`/app/case/${caseId}/ai-analysis`}>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Open AI Analysis
            </Link>
          </Button>
        </div>
      ) : laws.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <ScrollText className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No law references were identified in the documents.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {laws.map((law, i) => (
            <Card key={i} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{law.code}</Badge>
                <span className="text-sm font-semibold">Section {law.section}</span>
                {law.label && <span className="text-sm text-muted-foreground">{law.label}</span>}
                {law.equivalent && (
                  <Badge variant="outline" title="Modern equivalent from the curated IPC↔BNS reference data">
                    ≈ {law.equivalent}
                  </Badge>
                )}
              </div>
              {law.description && <p className="mt-1.5 text-sm text-muted-foreground">{law.description}</p>}
              {law.relevance && <p className="mt-1 text-xs text-muted-foreground">Relevance: {law.relevance}</p>}
              {law.sourceDocumentId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Source: {names[law.sourceDocumentId]}
                  {law.pageNumber != null ? ` · p.${law.pageNumber}` : ''}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
