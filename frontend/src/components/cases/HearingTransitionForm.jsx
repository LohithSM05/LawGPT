import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';

/**
 * `action` is one entry from HEARING_ACTIONS (config/caseOptions.js):
 * { status, label, needsReason, allowsNextDate }.
 *
 * Deliberately does NOT touch hearingDate on the current hearing — this
 * form only ever sets status/outcome/notes/reason on the existing record,
 * and — only if the user explicitly types a next date — asks the backend
 * to create a SEPARATE new hearing for it. See hearingController.transitionHearing.
 */
export default function HearingTransitionForm({ action, onSubmit, onCancel }) {
  const [adjournmentReason, setAdjournmentReason] = useState('');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [nextHearingNotes, setNextHearingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        status: action.status,
        adjournmentReason: adjournmentReason || undefined,
        outcome: outcome || undefined,
        notes: notes || undefined,
        nextHearingDate: nextHearingDate || undefined,
        nextHearingNotes: nextHearingNotes || undefined,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {action.status === 'completed' && (
        <div className="space-y-2">
          <Label htmlFor="outcome">Outcome</Label>
          <Textarea id="outcome" rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </div>
      )}

      {action.needsReason && (
        <div className="space-y-2">
          <Label htmlFor="adjournmentReason">Reason</Label>
          <Input
            id="adjournmentReason"
            placeholder="e.g. Counsel unavailable"
            value={adjournmentReason}
            onChange={(e) => setAdjournmentReason(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {action.allowsNextDate && (
        <>
          <div className="space-y-2">
            <Label htmlFor="nextHearingDate">Next hearing date (only if the court has already set one)</Label>
            <Input
              id="nextHearingDate"
              type="date"
              value={nextHearingDate}
              onChange={(e) => setNextHearingDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if no date has been given yet — LawGPT never guesses a hearing date. You can add it later
              once it&apos;s known.
            </p>
          </div>
          {nextHearingDate && (
            <div className="space-y-2">
              <Label htmlFor="nextHearingNotes">Notes for the next hearing</Label>
              <Input id="nextHearingNotes" value={nextHearingNotes} onChange={(e) => setNextHearingNotes(e.target.value)} />
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : action.label}
        </Button>
      </div>
    </form>
  );
}
