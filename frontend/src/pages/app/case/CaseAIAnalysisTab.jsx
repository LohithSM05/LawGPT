import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Loader2, RefreshCw, AlertTriangle, ScrollText, Clock, Users,
  Scale, ChevronDown, FileText,
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import analysisService from '../../../services/analysisService';

const ENTITY_LABELS = {
  person: 'Persons',
  organization: 'Organizations',
  date: 'Dates',
  amount: 'Amounts',
  place: 'Places',
  vehicle: 'Vehicles',
  statute: 'Statutes',
  other: 'Other',
};

function docNames(analysis) {
  const map = {};
  (analysis?.documents || []).forEach((d) => {
    map[d.documentId] = d.documentName || 'Document';
  });
  return map;
}

function Source({ names, item }) {
  const name = item.sourceDocumentId ? names[item.sourceDocumentId] : null;
  if (!name) return null;
  return (
    <span className="text-xs text-muted-foreground">
      Source: {name}
      {item.pageNumber != null ? ` · p.${item.pageNumber}` : ''}
    </span>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function AnalysisView({ analysis }) {
  const names = docNames(analysis);
  const entitiesByType = {};
  (analysis.entities || []).forEach((e) => {
    const key = ENTITY_LABELS[e.type] || ENTITY_LABELS.other;
    (entitiesByType[key] = entitiesByType[key] || []).push(e);
  });

  return (
    <div className="space-y-4">
      {analysis.retrievalUsed && (
        <p className="text-xs text-muted-foreground">
          Grounded via ChromaDB retrieval (English corpus).
        </p>
      )}

      <Section icon={ScrollText} title="Case summary">
        <p className="text-sm leading-relaxed text-foreground">
          {analysis.summary?.text || 'No summary.'}
        </p>
        {analysis.summary?.keyPoints?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {analysis.summary.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {point}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Clock} title="Document timeline">
        {analysis.timeline?.length ? (
          <ol className="space-y-3">
            {analysis.timeline.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.event}</p>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {item.date && <span>{item.date}</span>}
                    {item.text && <span className="italic">“{item.text}”</span>}
                    <Source names={names} item={item} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No timeline events extracted.</p>
        )}
      </Section>

      <Section icon={Users} title="Entities">
        {Object.keys(entitiesByType).length ? (
          <div className="space-y-3">
            {Object.entries(entitiesByType).map(([type, list]) => (
              <div key={type}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{type}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {list.map((e, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm">
                      {e.name}
                      {e.mentions > 1 && (
                        <Badge variant="outline" className="px-1 text-[10px]">×{e.mentions}</Badge>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No entities extracted.</p>
        )}
      </Section>

      <Section icon={Scale} title="Applicable laws">
        {analysis.laws?.length ? (
          <div className="space-y-2">
            {analysis.laws.map((law, i) => (
              <div key={i} className="rounded-md border border-border p-3">
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
                <div className="mt-1">
                  <Source names={names} item={law} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No law references extracted.</p>
        )}
      </Section>

      <Section icon={FileText} title="Per-document analysis">
        {analysis.documents?.length ? (
          <div className="space-y-2">
            {analysis.documents.map((doc) => (
              <details key={doc.documentId} className="rounded-md border border-border">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium hover:bg-muted">
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{doc.documentName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {doc.docType || 'No type'} · {doc.charCount?.toLocaleString?.() ?? 0} chars
                  </span>
                </summary>
                <div className="border-t border-border px-3 py-3 text-sm">
                  {doc.summary && <p className="text-foreground">{doc.summary}</p>}
                  {doc.keyPoints?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {doc.keyPoints.map((k, i) => (
                        <li key={i} className="flex gap-2 text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                          {k}
                        </li>
                      ))}
                    </ul>
                  )}
                  {doc.entities?.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {doc.entities.map((e, i) => (
                        <Badge key={i} variant="outline">{e.name}</Badge>
                      ))}
                    </p>
                  )}
                  {doc.laws?.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {doc.laws.map((l, i) => (
                        <Badge key={i} variant="secondary">{l.code} {l.section}</Badge>
                      ))}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No per-document breakdown.</p>
        )}
      </Section>
    </div>
  );
}

export default function CaseAIAnalysisTab() {
  const { caseId } = useOutletContext();
  const { i18n } = useTranslation();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const existing = await analysisService.getAnalysis(caseId);
      setAnalysis(existing);
    } catch (err) {
      if (err.response?.status === 404) {
        setAnalysis(null);
      } else {
        setError(err.response?.data?.message || err.message || 'Could not load analysis');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const language = i18n.language === 'kn' ? 'kn' : 'en';
      const result = await analysisService.runAnalysis(caseId, language);
      setAnalysis(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Analysis failed');
      try {
        await load(); // surface the persisted failed analysis state if any
      } catch (_e) {
        /* no persisted state */
      }
    } finally {
      setGenerating(false);
    }
  };

  const isFailed = analysis?.status === 'failed';

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">AI Analysis</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Auto-generated from the case&apos;s processed documents (summary, timeline, entities, applicable laws).
          </p>
        </div>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : analysis ? (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          ) : (
            <Sparkles className="mr-2 h-3.5 w-3.5" />
          )}
          {analysis ? 'Regenerate' : 'Generate analysis'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading analysis…</p>
      ) : generating ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing documents — this can take a minute…
        </p>
      ) : isFailed ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
          <p className="mt-3 text-sm font-medium">Analysis failed</p>
          {analysis?.error && <p className="mt-1 max-w-md text-sm text-muted-foreground">{analysis.error}</p>}
          <Button size="sm" variant="outline" className="mt-4" onClick={handleGenerate}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : !analysis ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Sparkles className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No analysis yet. Upload and process documents first, then generate an AI analysis.
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={handleGenerate}>
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Generate analysis
          </Button>
        </div>
      ) : (
        <AnalysisView analysis={analysis} />
      )}
    </div>
  );
}
