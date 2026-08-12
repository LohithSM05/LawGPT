import { useState } from 'react';
import {
  AlertCircle,
  Gavel,
  ShieldCheck,
  MessageSquare,
  Paperclip,
  Clock,
  StickyNote,
  FileBarChart,
} from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { cn } from '../../utils/cn';

const TABS = [
  { key: 'conversation', label: 'Conversation', icon: MessageSquare },
  { key: 'documents', label: 'Documents', icon: Paperclip },
  { key: 'evidence', label: 'Evidence', icon: ShieldCheck },
  { key: 'judgments', label: 'Judgments', icon: Gavel },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
];

function SummaryCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Case Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          FIR alleges criminal breach of trust and forgery relating to a disputed property sale between two
          parties, filed at the local station on 14 Feb 2025.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge>BNS s.316</Badge>
          <Badge>BNS s.338</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceStrengthCard() {
  const items = [
    { label: 'Sale deed (photocopy)', strength: 'Weak' },
    { label: 'Bank transfer records', strength: 'Strong' },
    { label: 'Witness statement — neighbour', strength: 'Medium' },
  ];
  const color = {
    Weak: 'text-destructive',
    Medium: 'text-accent-foreground dark:text-accent',
    Strong: 'text-primary',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Evidence Strength</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span>{item.label}</span>
            <span className={cn('font-mono text-xs font-semibold', color[item.strength])}>{item.strength}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SimilarJudgmentCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Similar Judgment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">State v. Ramesh Kumar</p>
        <p className="text-xs text-muted-foreground">Karnataka High Court · 2022 · 78% similarity</p>
        <p className="pt-1 text-muted-foreground">
          Comparable forgery-of-title-deed fact pattern where the accused was convicted primarily on documentary
          evidence.
        </p>
      </CardContent>
    </Card>
  );
}

export default function CaseWorkspacePreview() {
  const [activeTab, setActiveTab] = useState('conversation');

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 pt-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Design preview</strong> — this screen uses sample data to show the target case-workspace UX.
            It isn&apos;t connected to a real case yet; that lands with the document pipeline and analysis modules.
          </AlertDescription>
        </Alert>

        <div className="mt-4 flex gap-1 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm',
                activeTab === tab.key
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          {activeTab === 'conversation' ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
              <div className="ml-auto max-w-[80%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
                Summarize this case and flag the weakest piece of evidence.
              </div>

              <div className="flex flex-col gap-3">
                <SummaryCard />
                <EvidenceStrengthCard />
                <SimilarJudgmentCard />
              </div>

              <form className="mt-auto flex gap-2 pt-4" onSubmit={(e) => e.preventDefault()}>
                <Input placeholder="Ask about this case…" disabled />
                <Button type="submit" disabled>
                  Send
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {TABS.find((tab) => tab.key === activeTab)?.label} preview arrives with the module that builds it.
            </div>
          )}
        </div>

        <aside className="hidden w-72 shrink-0 border-l border-border p-4 lg:block">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Case details</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Case No.</dt>
              <dd className="font-mono">FIR-2025-00231</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Court</dt>
              <dd>Sample District Court</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sections</dt>
              <dd className="flex flex-wrap gap-1 pt-1">
                <Badge variant="secondary">BNS s.316</Badge>
                <Badge variant="secondary">BNS s.338</Badge>
              </dd>
            </div>
          </dl>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Citations</h3>
          <ul className="mt-2 space-y-2 text-sm text-primary">
            <li className="hover:underline">State v. Ramesh Kumar (2022)</li>
            <li className="hover:underline">BNS, Section 316</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
