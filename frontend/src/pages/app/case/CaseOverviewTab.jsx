import { useOutletContext, Link } from 'react-router-dom';
import { Gavel, FileText, ShieldCheck, StickyNote, Users, CalendarClock } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-lg font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

export default function CaseOverviewTab() {
  const { caseData, stats, caseId } = useOutletContext();

  const lastActivity = stats?.lastActivity ? new Date(stats.lastActivity).toLocaleString() : '—';
  const nextHearing = caseData.nextHearingDate ? new Date(caseData.nextHearingDate).toLocaleDateString() : 'Not scheduled';

  return (
    <div className="container max-w-4xl py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Gavel} label="Hearings" value={stats?.hearingCount ?? 0} />
        <StatCard icon={FileText} label="Documents" value={stats?.documentCount ?? 0} />
        <StatCard icon={ShieldCheck} label="Evidence items" value={stats?.evidenceCount ?? 0} />
        <StatCard icon={Users} label="Parties" value={caseData.parties?.length ?? 0} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Description</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {caseData.description || 'No description added yet.'}
          </p>

          {caseData.parties?.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Parties</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {caseData.parties.map((p) => (
                  <li key={p._id} className="flex justify-between text-muted-foreground">
                    <span className="text-foreground">{p.name}</span>
                    <span>{p.role}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold">At a glance</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> Next hearing
              </dt>
              <dd className="font-medium">{nextHearing}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Court</dt>
              <dd className="font-medium">{caseData.court || '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Jurisdiction</dt>
              <dd className="font-medium">{caseData.jurisdiction || '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Last activity</dt>
              <dd className="text-right font-medium">{lastActivity}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link to={`/app/case/${caseId}/hearings`}>
            <Gavel className="mr-2 h-3.5 w-3.5" />
            Add hearing
          </Link>
        </Button>
        <Button size="sm" asChild variant="outline">
          <Link to={`/app/case/${caseId}/notes`}>
            <StickyNote className="mr-2 h-3.5 w-3.5" />
            Add note
          </Link>
        </Button>
        <Button size="sm" variant="outline" disabled title="Arrives with the document pipeline in Module 4">
          <FileText className="mr-2 h-3.5 w-3.5" />
          Add document
        </Button>
        <Button size="sm" variant="outline" disabled title="Arrives with the document pipeline in Module 4">
          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
          Add evidence
        </Button>
      </div>
    </div>
  );
}
