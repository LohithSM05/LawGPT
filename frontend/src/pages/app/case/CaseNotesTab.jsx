import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trash2, Pencil, StickyNote, Send, Check, X } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import caseService from '../../../services/caseService';

export default function CaseNotesTab() {
  const { caseData, caseId, refetch } = useOutletContext();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const notes = [...(caseData.notes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    await caseService.addNote(caseId, content.trim());
    setContent('');
    setSubmitting(false);
    await refetch();
  };

  const startEdit = (note) => {
    setEditingId(note._id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (noteId) => {
    if (!editContent.trim()) return;
    await caseService.updateNote(caseId, noteId, editContent.trim());
    setEditingId(null);
    await refetch();
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    await caseService.deleteNote(caseId, noteId);
    await refetch();
  };

  return (
    <div className="container max-w-2xl py-6">
      <h2 className="mb-4 font-display text-lg font-semibold">Notes</h2>

      <form onSubmit={handleAdd} className="mb-6 flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note about this case…"
          rows={2}
          className="flex-1"
        />
        <Button type="submit" disabled={submitting || !content.trim()} className="self-end">
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <StickyNote className="h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No notes yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) =>
            editingId === note._id ? (
              <Card key={note._id} className="p-4">
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} className="mb-2" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => handleSaveEdit(note._id)}>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Save
                  </Button>
                </div>
              </Card>
            ) : (
              <Card key={note._id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm">{note.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(note.createdAt).toLocaleString()}
                    {note.updatedAt !== note.createdAt && ' (edited)'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => startEdit(note)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit note"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(note._id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Delete note"
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
