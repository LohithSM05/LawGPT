import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { iconFor } from '../../../config/caseEventIcons';
import caseService from '../../../services/caseService';

export default function CaseTimelineTab() {
  const { caseId } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    caseService.getTimeline(caseId).then((e) => {
      if (!cancelled) {
        setEvents(e);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (loading) return <div className="container py-8 text-sm text-muted-foreground">Loading timeline…</div>;

  return (
    <div className="container max-w-2xl py-6">
      <p className="mb-6 text-xs text-muted-foreground">
        Every event is a permanent log entry — a hearing being adjourned or rescheduled never rewrites or removes
        its original entry, it just adds a new one. Document, evidence, and witness events join this timeline once
        Module 4 builds them.
      </p>

      <ol className="relative border-l border-border pl-6">
        {events.map((event) => {
          const Icon = iconFor(event.eventType);
          const content = (
            <div className="pb-8">
              <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-primary" />
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">{event.title}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleDateString()} · {new Date(event.createdAt).toLocaleTimeString()}
              </p>
              {event.description && <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>}
            </div>
          );

          return (
            <li key={event._id}>
              {event.hearingId ? (
                <Link to={`/app/case/${caseId}/hearings/${event.hearingId}`} className="block hover:opacity-80">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
