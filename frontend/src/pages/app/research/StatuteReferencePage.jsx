import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, ChevronRight, Search, Scale } from 'lucide-react';
import { lawReferenceData } from '../../../data/lawReferenceData';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../utils/cn';

const ACTS = { bns: 'BNS', bnss: 'BNSS', bsa: 'BSA' };

/**
 * Renders the BNS / BNSS / BSA reference pages. All section text is the
 * source-verified, verbatim wording from the official India Code PDFs bundled
 * in frontend/src/data/lawReferenceData.js — nothing here is generated.
 *
 * Driven by the :slug route segment so a single component serves all three
 * statutes (see AppRoutes.jsx). Section detail is a plain client-side
 * expansion (no nested routing needed for a pure reference tool).
 */
export default function StatuteReferencePage() {
  const { slug } = useParams();
  const { t } = useTranslation('nav');
  const code = ACTS[slug];
  const act = code ? lawReferenceData[code] : null;

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [expandedChapter, setExpandedChapter] = useState(null);

  const filteredSections = useMemo(() => {
    if (!act) return [];
    const q = query.trim().toLowerCase();
    if (!q) return act.sections;

    const qNum = /^\d+$/.test(q) ? parseInt(q, 10) : null;
    return act.sections.filter((s) => {
      if (qNum != null && s.section === qNum) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.chapterTitle.toLowerCase().includes(q) ||
        (s.crossRefs || []).some((r) => r === qNum)
      );
    });
  }, [act, query]);

  const grouped = useMemo(() => {
    if (!act) return [];
    const map = new Map();
    filteredSections.forEach((s) => {
      if (!map.has(s.chapter)) map.set(s.chapter, []);
      map.get(s.chapter).push(s);
    });
    return Array.from(map.entries());
  }, [act, filteredSections]);

  const chapterIndex = useMemo(() => {
    if (!act) return {};
    return act.chapters.reduce((acc, c) => {
      acc[c.num] = c;
      return acc;
    }, {});
  }, [act]);

  if (!act) {
    return (
      <div className="container flex min-h-[60vh] max-w-xl flex-col items-center justify-center py-12 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Unknown statute.</p>
      </div>
    );
  }

  if (selected) {
    const ch = chapterIndex[selected.chapter];
    return (
      <div className="container max-w-3xl py-6">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => setSelected(null)}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {t('statute.backToList')}
        </Button>
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">Section {selected.section}</Badge>
            {ch && <Badge variant="secondary">Chapter {ch.roman}</Badge>}
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold">{selected.title}</h2>
          {ch && <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{selected.chapterTitle}</p>}
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">{selected.description}</p>
          {selected.punishment && (
            <div className="mt-5 rounded-md border border-border bg-muted/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('statute.punishment')}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{selected.punishment}</p>
            </div>
          )}
          {selected.crossRefs && selected.crossRefs.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('statute.relatedSections')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.crossRefs.map((r) => (
                  <button
                    key={r}
                    className="rounded-sm border border-border px-2 py-0.5 font-mono text-xs text-foreground/80 transition-colors hover:bg-muted"
                    onClick={() => {
                      const target = act.sections.find((s) => s.section === r);
                      if (target) setSelected(target);
                    }}
                  >
                    §{r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Scale className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold leading-tight">{act.shortTitle}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {act.actNo} · {act.enacted}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{act.preamble}</p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder={t('statute.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:text-right">
          {filteredSections.length} / {act.sectionCount} {t('statute.sections')}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{t('statute.chapters')}:</span>
        {act.chapters.map((c) => (
          <button
            key={c.num}
            className="rounded-sm border border-border px-1.5 py-0.5 font-mono transition-colors hover:bg-muted"
            onClick={() => setExpandedChapter(expandedChapter === c.num ? null : c.num)}
            title={`Chapter ${c.roman} · ${c.title}`}
          >
            {c.roman}
          </button>
        ))}
      </div>

      {filteredSections.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Search className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t('statute.noResults')}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map(([chapterNum, sections]) => {
            const ch = chapterIndex[chapterNum];
            const collapsed = expandedChapter !== null && expandedChapter !== chapterNum;
            return (
              <div key={chapterNum}>
                <button
                  className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-muted"
                  onClick={() => setExpandedChapter(expandedChapter === chapterNum ? null : chapterNum)}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight
                      className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expandedChapter === chapterNum && 'rotate-90')}
                    />
                    <span className="text-sm font-semibold">Chapter {ch.roman}</span>
                    <span className="text-xs text-muted-foreground">{ch.title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {sections[0].section}–{sections[sections.length - 1].section}
                  </span>
                </button>
                {!collapsed && (
                  <div className="mt-1.5 divide-y divide-border rounded-md border border-border">
                    {sections.map((s) => (
                      <button
                        key={s.section}
                        className="flex w-full items-baseline gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
                        onClick={() => setSelected(s)}
                      >
                        <span className="shrink-0 font-mono text-xs font-medium text-primary">§{s.section}</span>
                        <span className="truncate text-sm text-foreground/90">{s.title}</span>
                        {s.punishment && <Badge variant="outline" className="ml-auto shrink-0">{t('statute.punished')}</Badge>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        {t('statute.disclaimer')}
        <Button variant="link" size="sm" className="h-auto px-0 text-xs" asChild>
          <Link to="/app/cases/ongoing">{t('comingSoon.backToWorkspace')}</Link>
        </Button>
      </p>
    </div>
  );
}