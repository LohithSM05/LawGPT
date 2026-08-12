import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ComboInput } from '../ui/combo-input';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { hearingFormSchema } from '../../utils/caseValidationSchemas';
import { HEARING_TYPES, HEARING_STATUSES } from '../../config/caseOptions';

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Shared create/edit form for a hearing's own factual fields (date, court,
 * judge, type, summary, notes, outcome). Deliberately does NOT include
 * status or next-hearing-date/notes when editing an existing hearing
 * (`initialHearing` present) — those can only change through the guided
 * lifecycle actions (see HearingTransitionForm), which is what the backend
 * now enforces too (PUT /hearings/:id no longer accepts either field). When
 * creating a brand-new hearing, status is still offered (new hearings do
 * need SOME initial status, and there's no lifecycle history yet to bypass).
 */
export default function HearingForm({ initialHearing, onSubmit, onCancel, submitLabel = 'Save hearing' }) {
  const [serverError, setServerError] = useState(null);
  const isEditing = Boolean(initialHearing);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(hearingFormSchema),
    defaultValues: {
      hearingDate: toDateInputValue(initialHearing?.hearingDate),
      court: initialHearing?.court || '',
      judge: initialHearing?.judge || '',
      hearingType: initialHearing?.hearingType || '',
      status: initialHearing?.status || 'scheduled',
      summary: initialHearing?.summary || '',
      notes: initialHearing?.notes || '',
      outcome: initialHearing?.outcome || '',
    },
  });

  const submit = async (values) => {
    setServerError(null);
    // When editing, status isn't part of this form's UI (see below), but
    // react-hook-form's defaultValues still carries the original value
    // through since nothing re-registers it as changed. Strip it out
    // explicitly anyway so this form can never be the thing that changes
    // status on an existing hearing — that must go through /transition.
    const payload = isEditing ? { ...values, status: undefined } : values;
    try {
      await onSubmit(payload);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hearingDate">Hearing date</Label>
          <Input id="hearingDate" type="date" {...register('hearingDate')} />
          {errors.hearingDate && <p className="text-xs text-destructive">{errors.hearingDate.message}</p>}
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Only correct this if it was entered wrong. To adjourn/postpone/reschedule to a new date, use the
              hearing actions instead — that keeps this original date in the case history.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="hearingType">Hearing type</Label>
          <ComboInput id="hearingType" listId="hearing-type-options" options={HEARING_TYPES} placeholder="e.g. Bail Hearing" {...register('hearingType')} />
          {errors.hearingType && <p className="text-xs text-destructive">{errors.hearingType.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="court">Court</Label>
          <Input id="court" {...register('court')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="judge">Judge</Label>
          <Input id="judge" {...register('judge')} />
        </div>
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HEARING_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
      </div>

      {isEditing && (
        <p className="text-xs text-muted-foreground">
          Status is <span className="font-medium text-foreground">{initialHearing.status.replace('_', ' ')}</span> —
          change it using the hearing actions (Mark Completed, Adjourn, etc.) below, not here.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea id="summary" rows={2} {...register('summary')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="outcome">Outcome</Label>
        <Textarea id="outcome" rows={2} {...register('outcome')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={2} {...register('notes')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
