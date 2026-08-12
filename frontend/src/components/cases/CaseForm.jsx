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
import { caseFormSchema } from '../../utils/caseValidationSchemas';
import { CASE_TYPES, CASE_PRIORITIES } from '../../config/caseOptions';

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Shared by NewCase (create) and EditCase (edit). `initialCase` is the raw
 * Case document from the API for edit mode; omit it for create mode.
 */
export default function CaseForm({ initialCase, onSubmit, submitLabel = 'Save case' }) {
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      caseNumber: initialCase?.caseNumber || '',
      title: initialCase?.title || '',
      caseType: initialCase?.caseType || '',
      description: initialCase?.description || '',
      court: initialCase?.court || '',
      state: initialCase?.state || '',
      jurisdiction: initialCase?.jurisdiction || '',
      priority: initialCase?.priority || 'medium',
      filingDate: toDateInputValue(initialCase?.filingDate),
      tags: (initialCase?.tags || []).join(', '),
    },
  });

  const submit = async (values) => {
    setServerError(null);
    const payload = {
      ...values,
      filingDate: values.filingDate || null,
      tags: values.tags
        ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };
    try {
      await onSubmit(payload);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="caseNumber">Case number</Label>
          <Input id="caseNumber" placeholder="CR/2025/00231" {...register('caseNumber')} />
          {errors.caseNumber && <p className="text-xs text-destructive">{errors.caseNumber.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="caseType">Case type</Label>
          <ComboInput
            id="caseType"
            listId="case-type-options"
            options={CASE_TYPES}
            placeholder="e.g. Criminal"
            {...register('caseType')}
          />
          {errors.caseType && <p className="text-xs text-destructive">{errors.caseType.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" placeholder="State vs. Ramesh Kumar" {...register('title')} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} placeholder="Brief description of the case…" {...register('description')} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="court">Court</Label>
          <Input id="court" placeholder="District Court, Bengaluru" {...register('court')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" placeholder="Karnataka" {...register('state')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jurisdiction">Jurisdiction</Label>
          <Input id="jurisdiction" placeholder="Bengaluru Urban" {...register('jurisdiction')} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="filingDate">Filing date</Label>
          <Input id="filingDate" type="date" {...register('filingDate')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" placeholder="urgent, property, appeal" {...register('tags')} />
          <p className="text-xs text-muted-foreground">Comma-separated</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
