import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../../components/ui/card';
import { iconFor } from '../../../config/caseEventIcons';
import caseService from '../../../services/caseService';

export default function CaseActivityTab() {
  const { caseId } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    caseService.getTimeline(caseId).then((e) => {
      if (!cancelled) {
        setEvents([...e].reverse()); // most recent first for an activity feed
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div className="container max-w-2xl py-6">
      <h2 className="mb-2 font-display text-lg font-semibold">Activity</h2>
      <p className="mb-6 text-xs text-muted-foreground">
        Every logged case and hearing event, most recent first. This isn&apos;t a full field-level audit log yet
        (old value → new value for every edit) — that&apos;s a larger feature tracked as a follow-up in
        PROJECT_MEMORY.md.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const Icon = iconFor(event.eventType);
            return (
              <Card key={event._id} className="flex items-center gap-3 p-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{event.title}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleDateString()}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
