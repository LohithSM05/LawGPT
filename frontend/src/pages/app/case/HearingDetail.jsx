import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, FileText, ShieldCheck, UserSearch, ScrollText,
  MessageSquare, Activity, Plus, CheckCircle2, CalendarClock,
} from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import HearingForm from '../../../components/cases/HearingForm';
import HearingTransitionForm from '../../../components/cases/HearingTransitionForm';
import { HEARING_ACTIONS, HEARING_STATUS_BADGE_VARIANT } from '../../../config/caseOptions';
import hearingService from '../../../services/hearingService';

const PENDING_SECTIONS = [
  { label: 'New Documents', icon: FileText },
  { label: 'New Evidence', icon: ShieldCheck },
  { label: 'Witness Updates', icon: UserSearch },
  { label: 'Legal Developments', icon: ScrollText },
  { label: 'Arguments', icon: MessageSquare },
];

export default function HearingDetail() {
  const { caseId, hearingId } = useParams();
  const navigate = useNavigate();
  const [hearing, setHearing] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'view' | 'edit' | 'addNext' | one of HEARING_ACTIONS[].status
  const [mode, setMode] = useState('view');
  const [justScheduled, setJustScheduled] = useState(null);

  const load = () => hearingService.getHearing(caseId, hearingId).then(setHearing);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, hearingId]);

  const handleUpdate = async (payload) => {
    await hearingService.updateHearing(caseId, hearingId, payload);
    setMode('view');
    await load();
  };

  const handleTransition = async (payload) => {
    const { hearing: updated, newHearing } = await hearingService.transitionHearing(caseId, hearingId, payload);
    setHearing(updated);
    setMode('view');
    setJustScheduled(newHearing || null);
  };

  const handleAddNext = async (payload) => {
    const created = await hearingService.createHearing(caseId, { ...payload, previousHearingId: hearingId });
    navigate(`/app/case/${caseId}/hearings/${created._id}`, { replace: true });
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this hearing? It will no longer appear in the case\'s hearing list, but its history is preserved, not permanently erased.')) return;
    await hearingService.deleteHearing(caseId, hearingId);
    navigate(`/app/case/${caseId}/hearings`, { replace: true });
  };

  if (loading) return <div className="container py-12 text-sm text-muted-foreground">Loading hearing…</div>;
  if (!hearing) return <div className="container py-12 text-sm text-muted-foreground">Hearing not found.</div>;

  const activeAction = HEARING_ACTIONS.find((a) => a.status === mode);

  return (
    <div className="container max-w-2xl py-6">
      <Link to={`/app/case/${caseId}/hearings`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to hearings
      </Link>

      {justScheduled && (
        <Alert className="mb-4">
          <CalendarClock className="h-4 w-4" />
          <AlertDescription>
            Hearing #{justScheduled.hearingNumber} was scheduled for {new Date(justScheduled.hearingDate).toLocaleDateString()}.{' '}
            <Link to={`/app/case/${caseId}/hearings/${justScheduled._id}`} className="font-medium text-primary hover:underline" onClick={() => setJustScheduled(null)}>
              View it →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {mode === 'edit' ? (
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Edit hearing #{hearing.hearingNumber}</h2>
          <HearingForm initialHearing={hearing} onSubmit={handleUpdate} onCancel={() => setMode('view')} submitLabel="Save changes" />
        </Card>
      ) : mode === 'addNext' ? (
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Add next hearing</h2>
          <p className="mb-4 text-sm text-muted-foreground">This will be linked as the follow-up to hearing #{hearing.hearingNumber}.</p>
          <HearingForm onSubmit={handleAddNext} onCancel={() => setMode('view')} submitLabel="Add hearing" />
        </Card>
      ) : activeAction ? (
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">{activeAction.label} — Hearing #{hearing.hearingNumber}</h2>
          <HearingTransitionForm action={activeAction} onSubmit={handleTransition} onCancel={() => setMode('view')} />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold">Hearing #{hearing.hearingNumber}</h1>
              <p className="text-sm text-muted-foreground">{hearing.hearingType}</p>
              {hearing.previousHearingId && (
                <Link
                  to={`/app/case/${caseId}/hearings/${hearing.previousHearingId._id}`}
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  Follows Hearing #{hearing.previousHearingId.hearingNumber} ({hearing.previousHearingId.status})
                </Link>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setMode('edit')}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={handleDelete}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>

          {/* Guided lifecycle actions — each opens HearingTransitionForm above,
              which never touches this hearing's own date. */}
          <div className="mb-4 flex flex-wrap gap-2">
            {HEARING_ACTIONS.map((action) => (
              <Button key={action.status} size="sm" variant="outline" onClick={() => setMode(action.status)}>
                {action.label}
              </Button>
            ))}
            <Button size="sm" onClick={() => setMode('addNext')}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Next Hearing
            </Button>
          </div>

          <Card className="p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Date</dt>
                <dd className="mt-1 font-mono text-sm">{new Date(hearing.hearingDate).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge variant={HEARING_STATUS_BADGE_VARIANT[hearing.status] || 'outline'}>
                    {hearing.status.replace('_', ' ')}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Court</dt>
                <dd className="mt-1 text-sm">{hearing.court || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Judge</dt>
                <dd className="mt-1 text-sm">{hearing.judge || '—'}</dd>
              </div>
            </dl>

            {hearing.summary && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Summary</h3>
                <p className="mt-1 text-sm">{hearing.summary}</p>
              </div>
            )}
            {hearing.outcome && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Outcome</h3>
                <p className="mt-1 text-sm">{hearing.outcome}</p>
              </div>
            )}
            {hearing.adjournmentReason && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Reason</h3>
                <p className="mt-1 text-sm">{hearing.adjournmentReason}</p>
              </div>
            )}
            {hearing.notes && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Notes</h3>
                <p className="mt-1 text-sm">{hearing.notes}</p>
              </div>
            )}
            {hearing.nextHearingDate && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Next hearing (as decided at this hearing)</h3>
                <p className="mt-1 font-mono text-sm">{new Date(hearing.nextHearingDate).toLocaleDateString()}</p>
                {hearing.nextHearingNotes && <p className="mt-1 text-sm text-muted-foreground">{hearing.nextHearingNotes}</p>}
              </div>
            )}
          </Card>

          <Card className="mt-4 p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Activity
            </h3>
            <p className="text-sm text-muted-foreground">
              Created {new Date(hearing.createdAt).toLocaleString()}
              {hearing.updatedAt !== hearing.createdAt && ` · Updated ${new Date(hearing.updatedAt).toLocaleString()}`}
            </p>
          </Card>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PENDING_SECTIONS.map((s) => (
              <Card key={s.label} className="flex items-center gap-2 p-3 text-sm text-muted-foreground/70">
                <s.icon className="h-4 w-4" />
                {s.label}
                <Badge variant="accent" className="ml-auto text-[10px]">Module 4+</Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
