import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { ComboInput } from '../../../components/ui/combo-input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../components/ui/select';
import { partyFormSchema } from '../../../utils/caseValidationSchemas';
import { PARTY_ROLES } from '../../../config/caseOptions';
import caseService from '../../../services/caseService';

function PartyForm({ initial, onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(partyFormSchema),
    defaultValues: {
      name: initial?.name || '',
      role: initial?.role || '',
      entityType: initial?.entityType || 'person',
      contact: initial?.contact || '',
      notes: initial?.notes || '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <ComboInput id="role" listId="party-role-options" options={PARTY_ROLES} placeholder="e.g. Defendant" {...register('role')} />
          {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="entityType">Type</Label>
          <Controller
            name="entityType"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="entityType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact">Contact</Label>
          <Input id="contact" placeholder="Phone, email, or address" {...register('contact')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={2} {...register('notes')} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save party'}</Button>
      </div>
    </form>
  );
}

export default function CasePartiesTab() {
  const { caseData, caseId, refetch } = useOutletContext();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleAdd = async (values) => {
    await caseService.addParty(caseId, values);
    setAdding(false);
    await refetch();
  };

  const handleUpdate = async (partyId, values) => {
    await caseService.updateParty(caseId, partyId, values);
    setEditingId(null);
    await refetch();
  };

  const handleDelete = async (partyId) => {
    if (!window.confirm('Remove this party?')) return;
    await caseService.deleteParty(caseId, partyId);
    await refetch();
  };

  return (
    <div className="container max-w-2xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Parties</h2>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add party
          </Button>
        )}
      </div>

      {adding && (
        <Card className="mb-6 p-5">
          <PartyForm onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </Card>
      )}

      {caseData.parties?.length === 0 && !adding ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Users className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No parties added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {caseData.parties?.map((party) =>
            editingId === party._id ? (
              <Card key={party._id} className="p-5">
                <PartyForm
                  initial={party}
                  onSubmit={(values) => handleUpdate(party._id, values)}
                  onCancel={() => setEditingId(null)}
                />
              </Card>
            ) : (
              <Card key={party._id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{party.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {party.role} · {party.entityType}
                    {party.contact ? ` · ${party.contact}` : ''}
                  </p>
                  {party.notes && <p className="mt-1 text-sm text-muted-foreground">{party.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditingId(party._id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit party"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(party._id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Remove party"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
