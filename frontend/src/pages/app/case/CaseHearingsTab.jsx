import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Plus, Gavel } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { HEARING_STATUS_BADGE_VARIANT } from '../../../config/caseOptions';
import HearingForm from '../../../components/cases/HearingForm';
import hearingService from '../../../services/hearingService';

export default function CaseHearingsTab() {
  const { caseId, refetch } = useOutletContext();
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = () => hearingService.listHearings(caseId).then((h) => setHearings(h));

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const handleCreate = async (payload) => {
    await hearingService.createHearing(caseId, payload);
    setShowForm(false);
    await load();
    await refetch(); // case.nextHearingDate may have changed
  };

  return (
    <div className="container max-w-3xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Hearings</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add hearing
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6 p-5">
          <HearingForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} submitLabel="Add hearing" />
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading hearings…</p>
      ) : hearings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Gavel className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No hearings recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hearings.map((h) => (
            <Link key={h._id} to={`/app/case/${caseId}/hearings/${h._id}`}>
              <Card className="p-4 transition-colors hover:border-primary/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      Hearing #{h.hearingNumber} — {h.hearingType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.hearingDate).toLocaleDateString()}
                      {h.court ? ` · ${h.court}` : ''}
                      {h.judge ? ` · ${h.judge}` : ''}
                    </p>
                  </div>
                  <Badge variant={HEARING_STATUS_BADGE_VARIANT[h.status] || 'outline'}>{h.status.replace('_', ' ')}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
